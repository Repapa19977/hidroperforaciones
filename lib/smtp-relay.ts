import net from 'node:net'
import tls from 'node:tls'

type MailAddress = {
  email: string
  name?: string
}

type MailAttachment = {
  filename: string
  contentBase64: string
  contentType: string
}

export type SmtpRelayMail = {
  host: string
  port: number
  from: MailAddress
  to: string[]
  bcc?: string[]
  replyTo?: string
  subject: string
  text: string
  html: string
  attachments?: MailAttachment[]
}

type SmtpSocket = net.Socket | tls.TLSSocket

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function encodeHeader(value: string): string {
  const clean = sanitizeHeader(value)
  return /^[\x20-\x7e]*$/.test(clean)
    ? clean
    : `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`
}

function formatAddress(address: MailAddress): string {
  const email = sanitizeHeader(address.email)
  const name = sanitizeHeader(address.name ?? '')
  if (!name) return `<${email}>`
  return `"${name.replace(/"/g, '\\"')}" <${email}>`
}

function wrapBase64(value: string): string {
  return value.replace(/\s+/g, '').replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

function normalizeCrlf(value: string): string {
  return value.replace(/\r?\n/g, '\r\n')
}

function dotStuff(value: string): string {
  return normalizeCrlf(value).replace(/^\./gm, '..')
}

function createLineReader(socket: SmtpSocket, timeoutMs = 30000) {
  let buffer = ''
  const queue: string[] = []
  const waiters: Array<(line: string) => void> = []

  const pushLine = (line: string) => {
    const waiter = waiters.shift()
    if (waiter) waiter(line)
    else queue.push(line)
  }

  socket.on('data', chunk => {
    buffer += chunk.toString('utf8')
    while (true) {
      const idx = buffer.indexOf('\n')
      if (idx === -1) break
      const line = buffer.slice(0, idx).replace(/\r$/, '')
      buffer = buffer.slice(idx + 1)
      pushLine(line)
    }
  })

  return function readLine(): Promise<string> {
    const queued = queue.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve, reject) => {
      const waiter = (line: string) => {
        clearTimeout(timer)
        resolve(line)
      }
      const timer = setTimeout(() => {
        const idx = waiters.indexOf(waiter)
        if (idx >= 0) waiters.splice(idx, 1)
        reject(new Error('Timeout esperando respuesta SMTP'))
      }, timeoutMs)
      waiters.push(waiter)
    })
  }
}

async function readResponse(readLine: () => Promise<string>) {
  const lines: string[] = []
  let code = 0
  while (true) {
    const line = await readLine()
    lines.push(line)
    const parsedCode = Number(line.slice(0, 3))
    if (!Number.isNaN(parsedCode)) code = parsedCode
    if (/^\d{3} /.test(line)) return { code, lines }
  }
}

async function expectResponse(readLine: () => Promise<string>, expected: number[]) {
  const response = await readResponse(readLine)
  if (!expected.includes(response.code)) {
    throw new Error(`SMTP ${response.code}: ${response.lines.join(' | ')}`)
  }
  return response
}

function writeCommand(socket: SmtpSocket, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${command}\r\n`, err => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function buildMimeMessage(mail: SmtpRelayMail): string {
  const mixedBoundary = `hidrocrm-mixed-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const altBoundary = `hidrocrm-alt-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const recipients = mail.to.map(sanitizeHeader).join(', ')
  const headers = [
    `From: ${formatAddress(mail.from)}`,
    `To: ${recipients}`,
    mail.replyTo ? `Reply-To: ${sanitizeHeader(mail.replyTo)}` : '',
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(16).slice(2)}@hidroperforaciones.com>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ].filter(Boolean)

  const parts = [
    headers.join('\r\n'),
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizeCrlf(mail.text),
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizeCrlf(mail.html),
    '',
    `--${altBoundary}--`,
  ]

  for (const attachment of mail.attachments ?? []) {
    const filename = sanitizeHeader(attachment.filename)
    parts.push(
      '',
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      wrapBase64(attachment.contentBase64),
    )
  }

  parts.push('', `--${mixedBoundary}--`, '')
  return parts.join('\r\n')
}

function connect(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    // Google Workspace SMTP Relay was authorized with the VPS IPv4 address.
    // Force IPv4 so Node does not pick the server IPv6 address and get rejected.
    const socket = net.createConnection({ host, port, family: 4 }, () => resolve(socket))
    socket.once('error', reject)
  })
}

function startTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tls.connect({ socket, servername: host }, () => resolve(tlsSocket))
    tlsSocket.once('error', reject)
  })
}

export async function sendSmtpRelayMail(mail: SmtpRelayMail): Promise<void> {
  let socket: SmtpSocket | null = await connect(mail.host, mail.port)
  let readLine = createLineReader(socket)

  try {
    await expectResponse(readLine, [220])
    await writeCommand(socket, 'EHLO hidrocrm.hidroperforaciones.com')
    await expectResponse(readLine, [250])
    await writeCommand(socket, 'STARTTLS')
    await expectResponse(readLine, [220])

    socket = await startTls(socket as net.Socket, mail.host)
    readLine = createLineReader(socket)

    await writeCommand(socket, 'EHLO hidrocrm.hidroperforaciones.com')
    await expectResponse(readLine, [250])

    await writeCommand(socket, `MAIL FROM:<${mail.from.email}>`)
    await expectResponse(readLine, [250])

    for (const recipient of [...mail.to, ...(mail.bcc ?? [])]) {
      await writeCommand(socket, `RCPT TO:<${recipient}>`)
      await expectResponse(readLine, [250, 251])
    }

    await writeCommand(socket, 'DATA')
    await expectResponse(readLine, [354])
    await writeCommand(socket, `${dotStuff(buildMimeMessage(mail))}\r\n.`)
    await expectResponse(readLine, [250])
    await writeCommand(socket, 'QUIT')
  } finally {
    socket?.destroy()
  }
}
