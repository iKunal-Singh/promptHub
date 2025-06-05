import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import Button from '../common/Button';
import { Search, Filter, X } from 'lucide-react';
import { TagBadge } from '../common/TagBadge';

interface SearchFiltersProps {
  onSearch: (filters: any) => void;
  onReset: () => void;
  availableCategories: string[];
  availableModels: string[];
}

export default function SearchFilters({
  onSearch,
  onReset,
  availableCategories,
  availableModels
}: SearchFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [complexity, setComplexity] = useState<{ min: number; max: number }>({
    min: 1,
    max: 5
  });
  const [sortBy, setSortBy] = useState('relevance');
  const [sortDirection, setSortDirection] = useState('desc');

  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

  useEffect(() => {
    // Construct filters object similar to handleSearch
    const currentFilters = {
      query: debouncedSearchTerm, // Use debounced term
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      models: selectedModels.length > 0 ? selectedModels : undefined,
      dateRange: dateRange.start || dateRange.end ? {
        start: dateRange.start ? new Date(dateRange.start) : undefined,
        end: dateRange.end ? new Date(dateRange.end) : undefined,
      } : undefined,
      complexity: {
        min: complexity.min,
        max: complexity.max,
      },
      sort: {
        field: sortBy,
        direction: sortDirection,
      },
    };
    onSearch(currentFilters);
  }, [
    debouncedSearchTerm,
    selectedCategories,
    selectedModels,
    dateRange,
    complexity,
    sortBy,
    sortDirection,
    onSearch
  ]);

  const handleSearch = () => {
    // Manual search uses the immediate searchTerm, or could also use debouncedSearchTerm
    // For consistency with auto-search, let's use debouncedSearchTerm here too,
    // or ensure onSearch is robust to rapid calls if searchTerm is used.
    // The prompt asked to keep manual search, so it implies it can be immediate.
    // Let's keep it using the immediate searchTerm for now as it was.
    // Or, more simply, this button could just trigger what useEffect does if needed,
    // but the current implementation will call onSearch with potentially non-debounced term.
    // Given useEffect now handles debounced search, the manual button could be seen as an
    // "instant" search if desired, or it could be removed.
    // For this implementation, let's make manual search also use the latest filters including debounced term
    // to avoid confusion, though typically a manual button implies "search now with what I see".
    // The prompt implies to keep both, so handleSearch will just call onSearch with current raw state
    // if the user wants to bypass debounce.
    // Let's stick to the current implementation of handleSearch for now, which uses raw searchTerm.
    // The useEffect will handle the debounced search.
    onSearch({
      query: searchTerm, // Manual search uses the current (non-debounced) searchTerm
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      models: selectedModels.length > 0 ? selectedModels : undefined,
      dateRange: dateRange.start || dateRange.end ? {
        start: dateRange.start ? new Date(dateRange.start) : undefined,
        end: dateRange.end ? new Date(dateRange.end) : undefined
      } : undefined,
      complexity: {
        min: complexity.min,
        max: complexity.max
      },
      sort: {
        field: sortBy,
        direction: sortDirection
      }
    });
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedModels([]);
    setDateRange({ start: '', end: '' });
    setComplexity({ min: 1, max: 5 });
    setSortBy('relevance');
    setSortDirection('desc');
    // onReset might also need to clear searchTerm which then clears debouncedSearchTerm
    // and triggers a search with empty filters via useEffect. This is usually desired.
    onReset();
    // After onReset, useEffect will run with cleared filters.
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleModel = (model: string) => {
    setSelectedModels(prev =>
      prev.includes(model)
        ? prev.filter(m => m !== model)
        : [...prev, model]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Filter size={16} className="mr-2" />
          Search & Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search prompts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Categories
          </label>
          <div className="flex flex-wrap gap-2">
            {availableCategories.map(category => (
              <TagBadge
                key={category}
                variant={selectedCategories.includes(category) ? 'blue' : 'gray'}
                className="cursor-pointer"
                onClick={() => toggleCategory(category)}
              >
                {category}
              </TagBadge>
            ))}
          </div>
        </div>

        {/* Models */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            AI Models
          </label>
          <div className="flex flex-wrap gap-2">
            {availableModels.map(model => (
              <TagBadge
                key={model}
                variant={selectedModels.includes(model) ? 'purple' : 'gray'}
                className="cursor-pointer"
                onClick={() => toggleModel(model)}
              >
                {model}
              </TagBadge>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Complexity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Complexity Level
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="1"
              max="5"
              value={complexity.min}
              onChange={(e) => setComplexity(prev => ({ ...prev, min: parseInt(e.target.value) }))}
              className="flex-1"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="range"
              min="1"
              max="5"
              value={complexity.max}
              onChange={(e) => setComplexity(prev => ({ ...prev, max: parseInt(e.target.value) }))}
              className="flex-1"
            />
          </div>
          <div className="flex justify-between mt-1 text-sm text-gray-500">
            <span>Simple</span>
            <span>Complex</span>
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sort By
          </label>
          <div className="flex space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date</option>
              <option value="complexity">Complexity</option>
            </select>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="desc">DESC</option>
              <option value="asc">ASC</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            variant="outline"
            className="flex-1"
            leftIcon={<X size={16} />}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            className="flex-1"
            leftIcon={<Search size={16} />}
            onClick={handleSearch}
          >
            Search
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}