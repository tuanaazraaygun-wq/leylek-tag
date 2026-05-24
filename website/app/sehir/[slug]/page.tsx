import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CityLandingPage } from "@/components/city-landing-page";
import {
  CITY_LANDING_SLUGS,
  getCityLandingBySlug,
} from "@/lib/city-landing-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return CITY_LANDING_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = getCityLandingBySlug(slug);
  if (!content) return {};

  return {
    title: content.title,
    description: content.description,
    keywords: content.keywords,
    alternates: {
      canonical: `/sehir/${content.slug}`,
    },
    openGraph: {
      title: content.title,
      description: content.description,
      url: `/sehir/${content.slug}`,
    },
  };
}

export default async function CityLandingRoutePage({ params }: PageProps) {
  const { slug } = await params;
  const content = getCityLandingBySlug(slug);
  if (!content) notFound();

  return <CityLandingPage content={content} />;
}
