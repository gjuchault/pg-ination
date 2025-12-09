import { type SQL, sql } from "drizzle-orm";
import type { PaginateOptions, PaginateResult } from "../paginate.ts";
import { basePgAdapter } from "./base-pg/index.ts";
import type { AdapterResult } from "./index.ts";

export function drizzleAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<SQL> {
	const { cursor, filter, hasNextPage, hasPreviousPage, order } = basePgAdapter(
		options,
		result,
	);

	return {
		cursor: sql.raw(cursor),
		filter: filter === "true" ? sql`true` : sql.raw(filter),
		order: sql.raw(order),
		hasNextPage: sql.raw(`${hasNextPage}::boolean`),
		hasPreviousPage: sql.raw(`${hasPreviousPage}::boolean`),
	};
}
