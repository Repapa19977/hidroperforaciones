import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const existing = await prisma.adminUser.count();
    if (existing > 0) {
      return Response.json({ error: "Ya existe un administrador" }, { status: 400 });
    }

    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return Response.json({ error: "Todos los campos son requeridos" }, { status: 400 });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.adminUser.create({
      data: { email, password: hashed, name, role: "superadmin" },
    });

    return Response.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("Setup error:", err);
    return Response.json({ error: "Error interno", detail: String(err) }, { status: 500 });
  }
}
