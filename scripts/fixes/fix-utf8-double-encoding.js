// Fix selectivo para archivos con UTF-8 doble-encoded mezclado.
// Busca secuencias `c3 83 c2 XX` y `c3 82 c2 XX` (doble encoding de chars Latin-1
// 0x80-0xFF) y las reemplaza por los 2 bytes UTF-8 correctos.
// NO toca caracteres ya correctamente encodeados (c3 XX directo).

const fs = require('fs')

function fixDoubleUtf8(filePath) {
  const input = fs.readFileSync(filePath)
  const output = []

  let conversions = 0
  for (let i = 0; i < input.length; ) {
    // Patrón c3 83 c2 XX → c3 XX  (chars desde U+00C0 hasta U+00FF)
    if (i + 3 < input.length &&
        input[i]   === 0xc3 && input[i+1] === 0x83 &&
        input[i+2] === 0xc2 && input[i+3] >= 0x80 && input[i+3] <= 0xbf) {
      output.push(0xc3, input[i+3])
      i += 4
      conversions++
      continue
    }
    // Patrón c3 82 c2 XX → c2 XX  (chars desde U+0080 hasta U+00BF: ¡, ¿, ©, etc.)
    if (i + 3 < input.length &&
        input[i]   === 0xc3 && input[i+1] === 0x82 &&
        input[i+2] === 0xc2 && input[i+3] >= 0x80 && input[i+3] <= 0xbf) {
      output.push(0xc2, input[i+3])
      i += 4
      conversions++
      continue
    }
    output.push(input[i])
    i++
  }

  fs.writeFileSync(filePath, Buffer.from(output))
  return conversions
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Uso: node fix-utf8-double-encoding.js <file1> [file2] ...')
  process.exit(1)
}

for (const f of files) {
  const n = fixDoubleUtf8(f)
  console.log(`${f}: ${n} secuencias reencoded`)
}
