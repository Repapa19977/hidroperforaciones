import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/admin-auth";
import { slugify } from "@/lib/utils";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });

  if (!post) {
    return Response.json({ error: "Post no encontrado" }, { status: 404 });
  }

  return Response.json(post);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = authenticateAdmin(request);
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      data.title = body.title;
      data.slug = slugify(body.title);
    }
    if (body.excerpt !== undefined) data.excerpt = body.excerpt;
    if (body.content !== undefined) {
      data.content = body.content;
      data.readTime = Math.max(1, Math.ceil(body.content.split(/\s+/).length / 200));
    }
    if (body.coverImage !== undefined) data.coverImage = body.coverImage;
    if (body.published !== undefined) data.published = body.published;
    if (body.featured !== undefined) data.featured = body.featured;
    if (body.category !== undefined) data.category = body.category;

    const post = await prisma.post.update({ where: { id }, data });
    return Response.json(post);
  } catch {
    return Response.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = authenticateAdmin(request);
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.post.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
