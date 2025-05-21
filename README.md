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
   * the user cursor input, can be either { after: string }, { before: string } or undefined
   */
  pagination?: { after: string } | { before: string } | undefined;
  /**
   * the user ordering input, can be either { column: string, order: "asc" | "desc" } or undefined
   */
  orderBy?: { column: string; order: "asc" | "desc" } | undefined;
  /**
   * a function used to create a fragment out of an identifier (table names or columns)
   */
  identifier: (column: string) => SqlIdentifier;
  /**
   * a template literal function used to create a fragment out of a query
   */
  fragment: Sql;
}
```

## Usage

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

const settings = paginate({
  tableName: "users",
  pagination: undefined,
  orderBy: undefined,
  identifier: (columnName) => sql(columnName),
  fragment: sql,
});

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
const users = toSorted(unsortedUsers);

// use with { after: nextPageCursor }
const nextPageCursor = users.at(-1)?.cursor ?? undefined;
// use with { before: previousPageCursor }
const previousPageCursor = users.at(0)?.cursor ?? undefined;
```
