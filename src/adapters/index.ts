import type { PaginateOptions, PaginateResult } from "../paginate.ts";

export interface AdapterResult<Fragment> {
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

export type Adapter<Fragment> = (
	options: PaginateOptions,
	result: PaginateResult,
) => AdapterResult<Fragment>;
