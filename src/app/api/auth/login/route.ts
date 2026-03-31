import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email y contrasena requeridos" }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      return Response.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return Response.json({ error: "Credenciales invalidas" }, { status: 401 });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return Response.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch {
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
