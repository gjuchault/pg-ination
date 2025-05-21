import { type SQLQuery, sql } from "bun";
import type { PaginateOptions, PaginateResult } from "../paginate.ts";
import { basePgAdapter } from "./base-pg/index.ts";
import type { AdapterResult } from "./index.ts";

export function bunAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<SQLQuery> {
	const { cursor, filter, hasNextPage, hasPreviousPage, order } = basePgAdapter(
		options,
		result,
	);

	return {
		cursor: sql.unsafe(cursor),
		filter: sql.unsafe(filter),
		hasNextPage: sql.unsafe(hasNextPage),
		hasPreviousPage: sql.unsafe(hasPreviousPage),
		order: sql.unsafe(order),
	};
}
