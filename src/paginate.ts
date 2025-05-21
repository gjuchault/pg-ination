export interface Paginated<T> {
	data: T[];
	nextPageCursor?: string | undefined;
	previousPageCursor?: string | undefined;
}

export interface PaginateResult {
	cursor: string[];
	filter: { left: string[]; operator: ">" | "<"; right: string[] } | undefined;
	order: { column: string; order: "asc" | "desc" }[];
	hasNextPage: Pick<PaginateResult, "filter" | "order">;
	hasPreviousPage: Pick<PaginateResult, "filter" | "order">;
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
	orderBy?: { column: string; order: "asc" | "desc" } | undefined;
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
	let order: PaginateResult["order"] = [{ column: "id", order: "desc" }];
	let pageMode: PageMode = "next-below";

	if (orderBy?.order === "asc") {
		({ cursor, filter, order, pageMode } = handleAscendingOrder({
			tableName,
			pagination,
			orderByColumn: orderBy.column,
			tableId,
		}));
	}

	if (orderBy?.order === "desc") {
		({ cursor, filter, order, pageMode } = handleDescendingOrder({
			tableName,
			pagination,
			orderByColumn: orderBy.column,
			tableId,
		}));
	}

	if (orderBy === undefined && isAfter) {
		filter = { left: [tableId], operator: "<", right: [pagination.after] };
	} else if (orderBy === undefined && isBefore) {
		order = [{ column: "id", order: "asc" }];
		filter = { left: [tableId], operator: ">", right: [pagination.before] };
	}

	const { hasPreviousPage, hasNextPage } = getPagesExistence({
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
	};
}

function handleDescendingOrder({
	tableName,
	pagination,
	orderByColumn,
	tableId,
}: {
	tableName: string;
	pagination?: { after: string } | { before: string } | undefined;
	orderByColumn: string;
	tableId: string;
}): Pick<PaginateResult, "cursor" | "filter" | "order"> & {
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter: PaginateResult["filter"];

	const tableColumn = `${tableName}.${orderByColumn}`;
	const cursor: PaginateResult["cursor"] = [tableId, tableColumn];
	let order: PaginateResult["order"] = [
		{ column: tableColumn, order: "desc" },
		{ column: tableId, order: "desc" },
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
			{ column: tableColumn, order: "asc" },
			{ column: tableId, order: "asc" },
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
	tableId,
}: {
	tableName: string;
	pagination?: { after: string } | { before: string } | undefined;
	orderByColumn: string;
	tableId: string;
}): Pick<PaginateResult, "cursor" | "filter" | "order"> & {
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter: PaginateResult["filter"];

	const tableColumn = `${tableName}.${orderByColumn}`;
	const cursor: PaginateResult["cursor"] = [tableId, tableColumn];
	let order: PaginateResult["order"] = [
		{ column: tableColumn, order: "asc" },
		{ column: tableId, order: "asc" },
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
			{ column: tableColumn, order: "desc" },
			{ column: tableId, order: "desc" },
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
		throw new Error("Invalid cursor");
	}

	const id = cursor.slice(0, firstComma);
	const column = cursor.slice(firstComma + 1);
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
}): Pick<PaginateResult, "hasNextPage" | "hasPreviousPage"> {
	const pageId = "subquery.id";
	const tableId = `${tableName}.id`;
	const pageColumn = orderByColumn ? `subquery.${orderByColumn}` : undefined;
	const tableColumn = orderByColumn
		? `${tableName}.${orderByColumn}`
		: undefined;

	const nextOperator = pageMode === "next-below" ? "<" : ">";
	const previousOperator = pageMode === "next-below" ? ">" : "<";

	return {
		hasPreviousPage: {
			filter:
				pageColumn !== undefined && tableColumn !== undefined
					? {
							left: [pageColumn, pageId],
							operator: previousOperator,
							right: [tableColumn, tableId],
						}
					: {
							left: [pageId],
							operator: previousOperator,
							right: [tableId],
						},
			order,
		},
		hasNextPage: {
			filter:
				pageColumn !== undefined && tableColumn !== undefined
					? {
							left: [pageColumn, pageId],
							operator: nextOperator,
							right: [tableColumn, tableId],
						}
					: {
							left: [pageId],
							operator: nextOperator,
							right: [tableId],
						},
			order,
		},
	};
}
