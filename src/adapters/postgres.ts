import postgres from "postgres";
import type { PaginateOptions, PaginateResult } from "../paginate.ts";
import { basePgAdapter } from "./base-pg/index.ts";
import type { AdapterResult } from "./index.ts";

export function postgresAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<
	postgres.PendingQuery<(postgres.Row & Iterable<postgres.Row>)[]>
> {
	const { cursor, filter, hasNextPage, hasPreviousPage, order } = basePgAdapter(
		options,
		result,
	);

	const sql = postgres("");
	sql.end();

	return {
		cursor: sql.unsafe(cursor),
		filter: sql.unsafe(filter),
		order: sql.unsafe(order),
		hasNextPage: sql.unsafe(hasNextPage),
		hasPreviousPage: sql.unsafe(hasPreviousPage),
	};
}
