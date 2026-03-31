import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/admin-auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const user = authenticateAdmin(request);
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
      read: true,
      createdAt: true,
    },
  });

  return Response.json(messages);
}
