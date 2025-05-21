import type { PaginateOptions, PaginateResult } from "../paginate.ts";

export interface AdapterResult<Fragment> {
	cursor: Fragment;
	filter: Fragment;
	order: Fragment;
	hasNextPage: Fragment;
	hasPreviousPage: Fragment;
}

export type Adapter<Fragment> = (
	options: PaginateOptions,
	result: PaginateResult,
) => AdapterResult<Fragment>;
