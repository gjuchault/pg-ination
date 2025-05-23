# pg-ination

![NPM](https://img.shields.io/npm/l/pg-ination)
![NPM](https://img.shields.io/npm/v/pg-ination)
![GitHub Workflow Status](https://github.com/gjuchault/pg-ination/actions/workflows/pg-ination.yml/badge.svg?branch=main)

A utility to have arbitrary ordering with cursor based pagination, as well as next and previous page checks

**Limitations**:

- You must have a unique, always-increasing `id` field (eg. UUIDv7)
- You can't use sort by fields that do not come directly from the table (that would be a limitation for the next/previous page). [Example below](#subquery-pattern)

## Options

```ts
interface PaginateOptions<Sql, SqlIdentifier> {
  /**
   * the table where your data lives
   */
  tableName: string;
  /**
   * the user cursor input, can be either after, before or undefined
   */
  pagination?: { after: string } | { before: string } | undefined;
  /**
   * the user ordering input, can be either column and order or undefined
   */
  orderBy?: { column: string; order: "asc" | "desc" } | undefined;
}
```

## Adapter result

```ts
interface AdapterResult<Fragment> {
  /**
   * the cursor fragment (eg. `select ${cursor} as cursor`)
   */
  cursor: Fragment;
  /**
   * the filter fragment (eg. `where ${filter}`)
   */
  filter: Fragment;
  /**
   * the order fragment (eg. `order by ${order}`)
   */
  order: Fragment;
  /**
   * the hasNextPage fragment (eg. `select ${hasNextPage} as "hasNextPage"`)
   */
  hasNextPage: Fragment;
  /**
   * the hasPreviousPage fragment (eg. `select ${hasPreviousPage} as "hasPreviousPage"`)
   */
  hasPreviousPage: Fragment;
}
```

## Usage

```ts
// create search params
function paginate(options: PaginateOptions): PaginateResult;

// convert search params into SQL fragments with `pgAdapter`, `bunAdapter`, etc.
function adapter(
  options: PaginateOptions,
  result: PaginateResult
): AdapterResult;

// ensures sorting given the order by initial options
function toSorted<T>(data: T[], orderBy?: SortOptions["orderBy"]): T[];
```

### node-postgres

```ts
import { Client } from "pg";
import { paginate, toSorted } from "pg-ination";
import { pgAdapter } from "pg-ination/adapters/pg";

const options = {
  tableName: "foo",
  orderBy: { column: "name", order: "desc" },
};
const paginateResult = paginate(options);
const fragments = pgAdapter(options, paginateResult);

const client = new Client(process.env["DB_URI"]);

const settings = paginate({
  tableName: "users",
  pagination: undefined,
  orderBy: undefined,
});

// Fragments are escaped already

const unsortedUsers = await client.query(`
  select
    "id",
    ${fragments.cursor},
    ${fragments.hasNextPage} as "hasNextPage",
    ${fragments.hasPreviousPage} as "hasPreviousPage"
  from "users"
  where ${fragments.filter}
  order by ${fragments.order}
  limit 3
`);

// the applied order by might be different than the provided one to be used with `before` cursor
// hence you should always call `toSorted()` with the same settings as the `orderBy` of paginate
const users = toSorted(unsortedUsers, options.orderBy);

// use with { after: nextPageCursor }
const nextPageCursor = users.at(-1)?.cursor ?? undefined;
// use with { before: previousPageCursor }
const previousPageCursor = users.at(0)?.cursor ?? undefined;
```

### bun.sh

```ts
import { SQL } from "bun";
import { paginate, toSorted } from "pg-ination";
import { bunAdapter } from "pg-ination/adapters/bun";

const options = {
  tableName: "foo",
  orderBy: { column: "name", order: "desc" },
};
const paginateResult = paginate(options);
const fragments = bunAdapter(options, paginateResult);

const sql = new SQL(process.env["DB_URI"]);

// Fragments are escaped already

const unsortedUsers = await sql`
  select
    "id",
    ${fragments.cursor},
    ${fragments.hasNextPage} as "hasNextPage",
    ${fragments.hasPreviousPage} as "hasPreviousPage"
  from "users"
  where ${fragments.filter}
  order by ${fragments.order}
  limit 3
`;

// the applied order by might be different than the provided one to be used with `before` cursor
// hence you should always call `toSorted()` with the same settings as the `orderBy` of paginate
const users = toSorted(unsortedUsers, options.orderBy);

// use with { after: nextPageCursor }
const nextPageCursor = users.at(-1)?.cursor ?? undefined;
// use with { before: previousPageCursor }
const previousPageCursor = users.at(0)?.cursor ?? undefined;
```

### slonik

```ts
import { createPool, sql } from "bun";
import { paginate, toSorted } from "pg-ination";
import { slonikAdapter } from "pg-ination/adapters/slonik";

const options = {
  tableName: "foo",
  orderBy: { column: "name", order: "desc" },
};
const paginateResult = paginate(options);
const fragments = slonikAdapter(options, paginateResult);

const sql = await createPool(process.env["DB_URI"]);

// Fragments are escaped already

const unsortedUsers = await sql`
  select
    "id",
    ${fragments.cursor},
    ${fragments.hasNextPage} as "hasNextPage",
    ${fragments.hasPreviousPage} as "hasPreviousPage"
  from "users"
  where ${fragments.filter}
  order by ${fragments.order}
  limit 3
`;

// the applied order by might be different than the provided one to be used with `before` cursor
// hence you should always call `toSorted()` with the same settings as the `orderBy` of paginate
const users = toSorted(unsortedUsers, options.orderBy);

// use with { after: nextPageCursor }
const nextPageCursor = users.at(-1)?.cursor ?? undefined;
// use with { before: previousPageCursor }
const previousPageCursor = users.at(0)?.cursor ?? undefined;
```

### Subquery pattern

```ts
const paginateOptions: PaginateOptions = {
  tableName: "table_sq",
  pagination,
  orderBy,
};
const paginateResult = paginate(paginateOptions);
const adapterResult = xAdapter(paginateOptions, paginateResult);

const result = await query(sql`
	with "table_sq" as (
		select
			"table"."id",
			"table"."name",
			"table"."created_at",
			"joined_table"."foo"
		from "table"
		left join "joined_table"
			on "joined_table"."table_id" = "table"."id"
	)
	select
		*,
		${adapterResult.cursor} as "cursor",
		${adapterResult.hasNextPage} as "hasNextPage",
		${adapterResult.hasPreviousPage} as "hasPreviousPage"
	from "source_sq"
	where ${adapterResult.filter}
	order by ${adapterResult.order}
	limit 5
`);
```

## Why is `toSorted()` needed?

When going backwards, keeping the initial order would mean selecting last rows.
Example:

```sql
-- first page: F, E
select name
from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as name
order by name DESC
limit 2;

-- second page: D, C
select name
from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as name
where name < 'E'
order by name DESC
limit 2;


-- third page: B, A
select name
from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as name
where name < 'C'
order by name DESC
limit 2;

-- now pressing back to second page, keeping the same order
-- this incorrectly returns F, E
select name
from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as name
where name > 'B'
order by name DESC
limit 2;

-- so instead we sort ascending since we're going backwards
-- this returns C, D which we can reverse to get D, C
select name
from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as name
where name < 'B'
order by name ASC
limit 2;
```
