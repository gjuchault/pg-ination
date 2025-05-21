import type { PaginateOptions, PaginateResult } from "../paginate.ts";
import { basePgAdapter } from "./base-pg/index.ts";
import type { AdapterResult } from "./index.ts";

export function pgAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<string> {
	const { cursor, filter, hasNextPage, hasPreviousPage, order } = basePgAdapter(
		options,
		result,
	);

	return {
		cursor,
		filter,
		order,
		hasNextPage,
		hasPreviousPage,
	};
}
