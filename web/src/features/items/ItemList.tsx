import { useMemo, useState } from "react";
import { FilterBar } from "./FilterBar";
import { ItemTable } from "./ItemTable";
import { NO_FILTERS, columnsFor, filterRows, sortRows, type Filters, type Sort } from "./logic";
import { useRows } from "./useRows";

interface Props {
  /** categories to list (undefined = every category) */
  keys?: string[];
  /** wait until the visitor types a search or sets a filter before loading anything */
  lazy?: boolean;
  caption: string;
  classFilter?: boolean;
}

/** Filterable, sortable list of the items in some categories. */
export function ItemList({ keys, lazy, caption, classFilter = true }: Props) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>({ key: "il", dir: "desc" });
  const active = filters !== NO_FILTERS && JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const { rows, error } = useRows(lazy && !active ? null : keys);
  const shown = useMemo(() => (rows ? sortRows(filterRows(rows, filters), sort) : []), [rows, filters, sort]);
  const columns = useMemo(() => (rows ? columnsFor(rows) : []), [rows]);
  return (
    <div className="space-y-3">
      <FilterBar value={filters} onChange={setFilters} classFilter={classFilter} />
      {error ? (
        <p role="alert" className="text-sm text-warn">Could not load items: {error}</p>
      ) : lazy && !active ? (
        <p className="text-sm text-dim">Type a name or set a filter to search every item, or pick a category.</p>
      ) : !rows ? (
        <p className="text-sm text-dim">Loading items...</p>
      ) : (
        <ItemTable key={JSON.stringify(filters)} rows={shown} columns={columns} sort={sort} onSort={setSort} caption={caption} />
      )}
    </div>
  );
}
