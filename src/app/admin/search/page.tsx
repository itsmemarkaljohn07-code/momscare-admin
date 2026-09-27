import { buildSearchIndex, filterSearchIndex } from '@/lib/build-search-index';
import { PageHeader } from '@/components/page-header';
import { SearchResultsList } from '@/components/search-results-list';

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? '';
  const index = await buildSearchIndex();
  const results = filterSearchIndex(index, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Results"
        description={query ? `Results for "${query}"` : 'Enter a search term to get started.'}
      />
      <SearchResultsList results={results} />
    </div>
  );
}