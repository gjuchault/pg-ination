# pg-ination

![NPM](https://img.shields.io/npm/l/pg-ination)
![NPM](https://img.shields.io/npm/v/pg-ination)
![GitHub Workflow Status](https://github.com/gjuchault/pg-ination/actions/workflows/pg-ination.yml/badge.svg?branch=main)

A utility to have arbitrary ordering with cursor based pagination, as well as next and previous page checks

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
