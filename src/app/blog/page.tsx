import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import BlogList from "./blog-list";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articulos sobre pozos mecanicos, mantenimiento, bombas sumergibles y agua subterranea en Guatemala.",
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      category: true,
      readTime: true,
      createdAt: true,
      coverImage: true,
    },
  });

  return <BlogList posts={posts} />;
}
