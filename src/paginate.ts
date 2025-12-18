export type Filter =
	| {
			left: string[];
			operator: ">" | "<";
			right: string[];
	  }
	| {
			left: string[];
			operator: "is null" | "is not null";
	  };

export interface Order {
	column: string;
	order: "asc" | "desc";
	type?: "numeric" | "timestamp" | "text" | undefined;
}
export interface PaginateResult {
	cursor: string[];
	filter: Filter | undefined;
	order: Order[];
	hasNextPage: { filters: Filter[]; order: Order[] };
	/**
	 * Specific filter for the case where a specific order is asked, and it might be null
	 */
	hasNextPageNullColumn: { filters: Filter[]; order: Order[] } | undefined;
	hasPreviousPage: { filters: Filter[]; order: Order[] };
	/**
	 * Specific filter for the case where a specific order is asked, and it might be null
	 */
	hasPreviousPageNullColumn: { filters: Filter[]; order: Order[] } | undefined;
}

type PageMode = "next-below" | "next-above";

export interface PaginateOptions {
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
	orderBy?:
		| {
				column: string;
				order: "asc" | "desc";
				type?: "numeric" | "timestamp" | "text" | undefined;
		  }
		| undefined;
}

/**
 * Create fragments to be used in a SQL query to paginate a table with cursor based pagination.
 * @param payload - The pagination settings.
 * @returns A `PaginateResult` object containing the fragments to be used in a SQL query to paginate a table.
 */
export function paginate({
	tableName,
	pagination,
	orderBy,
}: PaginateOptions): PaginateResult {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	const tableId = `${tableName}.id`;

	let filter: PaginateResult["filter"];
	let cursor: PaginateResult["cursor"] = [tableId];
	let order: PaginateResult["order"] = [
		{ column: "id", order: "desc", type: "text" },
	];
	let pageMode: PageMode = "next-below";

	if (orderBy?.order === "asc") {
		({ cursor, filter, order, pageMode } = handleAscendingOrder({
			tableName,
			pagination,
			orderByColumn: orderBy.column,
			orderByType: orderBy.type ?? "text",
			tableId,
		}));
	}

	if (orderBy?.order === "desc") {
		({ cursor, filter, order, pageMode } = handleDescendingOrder({
			tableName,
			pagination,
			orderByColumn: orderBy.column,
			orderByType: orderBy.type ?? "text",
			tableId,
		}));
	}

	if (orderBy === undefined && isAfter) {
		filter = { left: [tableId], operator: "<", right: [pagination.after] };
	} else if (orderBy === undefined && isBefore) {
		order = [{ column: "id", order: "asc", type: "text" }];
		filter = { left: [tableId], operator: ">", right: [pagination.before] };
	}

	const {
		hasPreviousPage,
		hasNextPage,
		hasPreviousPageNullColumn,
		hasNextPageNullColumn,
	} = getPagesExistence({
		tableName,
		orderByColumn: orderBy?.column,
		pageMode,
		order,
	});

	return {
		cursor,
		filter,
		order,
		hasPreviousPage,
		hasNextPage,
		hasNextPageNullColumn,
		hasPreviousPageNullColumn,
	};
}

function handleDescendingOrder({
	tableName,
	pagination,
	orderByColumn,
	orderByType = "text",
	tableId,
}: {
	tableName: string;
	pagination?: { after: string } | { before: string } | undefined;
	orderByColumn: string;
	orderByType?: "numeric" | "timestamp" | "text";
	tableId: string;
}): Pick<PaginateResult, "cursor" | "filter" | "order"> & {
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter: PaginateResult["filter"];

	const tableColumn = `${tableName}.${orderByColumn}`;
	const cursor: PaginateResult["cursor"] = [tableColumn, tableId];
	let order: PaginateResult["order"] = [
		{ column: tableColumn, order: "desc", type: orderByType },
		{ column: tableId, order: "desc", type: "text" },
	];
	const pageMode: PageMode = "next-below";

	if (isAfter) {
		const { id, column } = getCursorComparator(pagination.after);
		filter = {
			left: [tableColumn, tableId],
			operator: "<",
			right: [column, id],
		};
	} else if (isBefore) {
		order = [
			{ column: tableColumn, order: "asc", type: orderByType },
			{ column: tableId, order: "asc", type: "text" },
		];

		const { id, column } = getCursorComparator(pagination.before);
		filter = {
			left: [tableColumn, tableId],
			operator: ">",
			right: [column, id],
		};
	}

	return {
		cursor,
		filter,
		order,
		pageMode,
	};
}

function handleAscendingOrder({
	tableName,
	pagination,
	orderByColumn,
	orderByType,
	tableId,
}: {
	tableName: string;
	pagination?: { after: string } | { before: string } | undefined;
	orderByColumn: string;
	orderByType: "numeric" | "text" | "timestamp";
	tableId: string;
}): Pick<PaginateResult, "cursor" | "filter" | "order"> & {
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter: PaginateResult["filter"];

	const tableColumn = `${tableName}.${orderByColumn}`;
	const cursor: PaginateResult["cursor"] = [tableColumn, tableId];
	let order: PaginateResult["order"] = [
		{ column: tableColumn, order: "asc", type: orderByType },
		{ column: tableId, order: "asc", type: "text" },
	];

	const pageMode: PageMode = "next-above";

	if (isAfter) {
		const { id, column } = getCursorComparator(pagination.after);
		filter = {
			left: [tableColumn, tableId],
			operator: ">",
			right: [column, id],
		};
	} else if (isBefore) {
		order = [
			{ column: tableColumn, order: "desc", type: orderByType },
			{ column: tableId, order: "desc", type: "text" },
		];
		const { id, column } = getCursorComparator(pagination.before);
		filter = {
			left: [tableColumn, tableId],
			operator: "<",
			right: [column, id],
		};
	}

	return {
		cursor,
		filter,
		order,
		pageMode,
	};
}

function getCursorComparator(cursor: string): {
	id: string;
	column: string;
} {
	const firstComma = cursor.indexOf(",");

	if (firstComma === -1) {
		return { id: cursor, column: "" };
	}

	const column = cursor.slice(0, firstComma);
	const id = cursor.slice(firstComma + 1);
	return { id, column };
}

function getPagesExistence({
	tableName,
	orderByColumn,
	pageMode,
	order,
}: {
	tableName: string;
	orderByColumn?: string | undefined;
	pageMode: PageMode;
	order: PaginateResult["order"];
}): Pick<
	PaginateResult,
	| "hasNextPage"
	| "hasPreviousPage"
	| "hasNextPageNullColumn"
	| "hasPreviousPageNullColumn"
> {
	const pageId = "subquery.id";
	const tableId = `${tableName}.id`;
	const pageColumn = orderByColumn ? `subquery.${orderByColumn}` : undefined;
	const tableColumn = orderByColumn
		? `${tableName}.${orderByColumn}`
		: undefined;

	const nextOperator = pageMode === "next-below" ? "<" : ">";
	const previousOperator = pageMode === "next-below" ? ">" : "<";

	const orderOnSubquery = order.map(({ column, order, type }) => ({
		column: column.replace(tableName, "subquery"),
		order,
		type: type ?? "text",
	}));

	const hasPreviousPage = {
		filters:
			pageColumn !== undefined && tableColumn !== undefined
				? [
						{
							left: [pageColumn, pageId],
							operator: previousOperator,
							right: [tableColumn, tableId],
						},
					]
				: [
						{
							left: [pageId],
							operator: previousOperator,
							right: [tableId],
						},
					],
		order: orderOnSubquery,
	} satisfies { filters: Filter[]; order: Order[] };

	const hasNextPage = {
		filters:
			pageColumn !== undefined && tableColumn !== undefined
				? [
						{
							left: [pageColumn, pageId],
							operator: nextOperator,
							right: [tableColumn, tableId],
						},
					]
				: [
						{
							left: [pageId],
							operator: nextOperator,
							right: [tableId],
						},
					],
		order: orderOnSubquery,
	} satisfies { filters: Filter[]; order: Order[] };

	const hasPreviousPageNullColumn =
		pageColumn !== undefined && tableColumn !== undefined
			? ({
					filters: [
						{
							left: [pageId],
							operator: previousOperator,
							right: [tableId],
						},
						{
							left: [pageColumn],
							operator: "is null",
						},
					],
					order: orderOnSubquery,
				} satisfies { filters: Filter[]; order: Order[] })
			: undefined;

	const hasNextPageNullColumn =
		pageColumn !== undefined && tableColumn !== undefined
			? ({
					filters: [
						{
							left: [pageId],
							operator: nextOperator,
							right: [tableId],
						},
						{
							left: [pageColumn],
							operator: "is null",
						},
					],
					order: orderOnSubquery,
				} satisfies { filters: Filter[]; order: Order[] })
			: undefined;

	return {
		hasNextPage,
		hasPreviousPage,
		hasNextPageNullColumn,
		hasPreviousPageNullColumn,
	};
}
