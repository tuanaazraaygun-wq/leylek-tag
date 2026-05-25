import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideArticlePage } from "@/components/guide-article-page";
import { getGuideBySlug, GUIDE_SLUGS } from "@/lib/guide-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getGuideBySlug(slug);
  if (!article) return {};

  const ogTitle = `${article.title} | Leylek TAG`;

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `/rehber/${article.slug}`,
    },
    openGraph: {
      title: ogTitle,
      description: article.description,
      url: `/rehber/${article.slug}`,
    },
  };
}

export default async function GuideArticleRoutePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getGuideBySlug(slug);
  if (!article) notFound();

  return <GuideArticlePage article={article} />;
}
