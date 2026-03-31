import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/admin-auth";
import { slugify } from "@/lib/utils";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const published = searchParams.get("published");
  const featured = searchParams.get("featured");
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (published === "true") where.published = true;
  if (featured === "true") where.featured = true;
  if (category) where.category = category;

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return Response.json(posts);
}

export async function POST(request: NextRequest) {
  const user = authenticateAdmin(request);
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, excerpt, content, coverImage, published, featured, category } = body;

    if (!title || !excerpt || !content) {
      return Response.json({ error: "Campos requeridos faltantes" }, { status: 400 });
    }

    const slug = slugify(title);
    const readTime = Math.max(1, Math.ceil(content.split(/\s+/).length / 200));

    const post = await prisma.post.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage: coverImage || "",
        published: published ?? false,
        featured: featured ?? false,
        category: category || "general",
        readTime,
      },
    });

    return Response.json(post, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ error: message }, { status: 500 });
  }
}
