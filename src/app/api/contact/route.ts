import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return Response.json({ error: "Campos requeridos faltantes" }, { status: 400 });
    }

    const contact = await prisma.contactMessage.create({
      data: { name, email, phone: phone || "", subject, message },
    });

    return Response.json({ success: true, id: contact.id });
  } catch {
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
