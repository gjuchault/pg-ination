import { type FragmentSqlToken, sql } from "slonik";
import type { PaginateOptions, PaginateResult } from "../paginate.ts";
import { basePgAdapter } from "./base-pg/index.ts";
import type { AdapterResult } from "./index.ts";

const fragment = sql.fragment``;
function raw(input: string): FragmentSqlToken {
	return {
		sql: input,
		type: fragment.type,
		values: [],
	};
}

export function slonikAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<FragmentSqlToken> {
	const { cursor, filter, hasNextPage, hasPreviousPage, order } = basePgAdapter(
		options,
		result,
	);

	return {
		cursor: raw(cursor),
		filter: raw(filter),
		order: raw(order),
		hasNextPage: raw(hasNextPage),
		hasPreviousPage: raw(hasPreviousPage),
	};
}
