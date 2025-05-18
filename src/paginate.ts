export interface Paginated<T> {
	data: T[];
	nextPageCursor?: string | undefined;
	previousPageCursor?: string | undefined;
}

export interface PaginateResult<SqlQuery> {
	cursor: SqlQuery;
	filter: SqlQuery;
	order: SqlQuery;
	hasNextPage: SqlQuery;
	hasPreviousPage: SqlQuery;
}

type PageMode = "next-below" | "next-above";

export interface PaginateOptions<Sql, SqlIdentifier> {
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

/**
 * Create fragments to be used in a SQL query to paginate a table with cursor based pagination.
 * @param payload - The pagination settings.
 * @returns A `PaginateResult` object containing the fragments to be used in a SQL query to paginate a table.
 */
export function paginate<
	Sql extends (...args: unknown[]) => SqlQuery,
	SqlIdentifier,
	SqlQuery,
>({
	tableName: rawTableName,
	pagination,
	orderBy,
	identifier,
	fragment,
}: PaginateOptions<Sql, SqlIdentifier>): PaginateResult<SqlQuery> {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	const tableName = identifier(rawTableName);
	const tableId = identifier(`${rawTableName}.id`);

	let filter = fragment`1 = 1`;
	let cursor = fragment`${tableId} as "cursor"`;
	let order = fragment`${tableId} desc`;
	let pageMode: PageMode = "next-below";

	if (orderBy?.order === "asc") {
		({ cursor, filter, order, pageMode } = handleAscendingOrder<
			Sql,
			SqlIdentifier,
			SqlQuery
		>({
			tableName: rawTableName,
			pagination,
			orderByColumn: orderBy.column,
			tableId,
			identifier,
			fragment,
		}));
	}

	if (orderBy?.order === "desc") {
		({ cursor, filter, order, pageMode } = handleDescendingOrder<
			Sql,
			SqlIdentifier,
			SqlQuery
		>({
			tableName: rawTableName,
			pagination,
			orderByColumn: orderBy.column,
			tableId,
			identifier,
			fragment,
		}));
	}

	if (orderBy === undefined && isAfter) {
		filter = fragment`${tableId} < ${pagination.after}::uuid`;
	} else if (orderBy === undefined && isBefore) {
		order = fragment`${tableId} asc`;
		filter = fragment`${tableId} > ${pagination.before}::uuid`;
	}

	const { hasPreviousPage, hasNextPage } = getPagesExistence({
		tableName,
		tableId,
		pageMode,
		order,
		fragment,
		identifier,
	});

	return {
		cursor,
		filter,
		order,
		hasPreviousPage,
		hasNextPage,
	};
}

function handleDescendingOrder<
	Sql extends (...args: unknown[]) => SqlQuery,
	SqlIdentifier,
	SqlQuery,
>({
	tableName: rawTableName,
	pagination,
	orderByColumn,
	tableId,
	identifier = (column) => column as SqlIdentifier,
	fragment = ((column) => column) as Sql,
}: {
	tableName: string;
	pagination?: { after: string } | { before: string } | undefined;
	orderByColumn: string;
	tableId: SqlIdentifier;
	identifier?: (column: string) => SqlIdentifier;
	fragment?: Sql;
}): {
	cursor: SqlQuery;
	filter: SqlQuery;
	order: SqlQuery;
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter = fragment`1 = 1`;

	const tableColumn = identifier(`${rawTableName}.${orderByColumn}`);
	const cursor = fragment`(${tableId} || ',' || ${tableColumn}) as "cursor"`;
	let order = fragment`${tableColumn} desc, ${tableId} desc`;
	const pageMode: PageMode = "next-below";

	if (isAfter) {
		const { id, column } = getCursorComparator(pagination.after);
		filter = fragment`(${tableColumn}, ${tableId}) < (${column}, ${id})`;
	} else if (isBefore) {
		order = fragment`${tableColumn} asc, ${tableId} asc`;

		const { id, column } = getCursorComparator(pagination.before);
		filter = fragment`(${tableColumn}, ${tableId}) > (${column}, ${id})`;
	}

	return {
		cursor,
		filter,
		order,
		pageMode,
	};
}

function handleAscendingOrder<
	Sql extends (...args: unknown[]) => SqlQuery,
	SqlIdentifier,
	SqlQuery,
>({
	tableName: rawTableName,
	pagination,
	orderByColumn,
	tableId,
	identifier = (column) => column as SqlIdentifier,
	fragment = ((column) => column) as Sql,
}: {
	tableName: string;
	pagination?: { after: string } | { before: string } | undefined;
	orderByColumn: string;
	tableId: SqlIdentifier;
	identifier?: (column: string) => SqlIdentifier;
	fragment?: Sql;
}): {
	cursor: SqlQuery;
	filter: SqlQuery;
	order: SqlQuery;
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter = fragment`1 = 1`;

	const tableColumn = identifier(`${rawTableName}.${orderByColumn}`);
	const cursor = fragment`(${tableId} || ',' || ${tableColumn}) as "cursor"`;
	let order = fragment`${tableColumn} asc, ${tableId} asc`;

	const pageMode: PageMode = "next-above";

	if (isAfter) {
		const { id, column } = getCursorComparator(pagination.after);
		filter = fragment`(${tableColumn}, ${tableId}) > (${column}, ${id})`;
	} else if (isBefore) {
		order = fragment`${tableColumn} desc, ${tableId} desc`;
		const { id, column } = getCursorComparator(pagination.before);
		filter = fragment`(${tableColumn}, ${tableId}) < (${column}, ${id})`;
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

function getPagesExistence<
	Sql extends (...args: unknown[]) => SqlQuery,
	SqlIdentifier,
	SqlQuery,
>({
	tableName,
	tableId,
	pageMode,
	order,
	identifier = (column) => column as SqlIdentifier,
	fragment = ((column) => column) as Sql,
}: {
	tableName: SqlIdentifier;
	tableId: SqlIdentifier;
	pageMode: PageMode;
	order: SqlQuery;
	identifier?: (column: string) => SqlIdentifier;
	fragment?: Sql;
}): { hasPreviousPage: SqlQuery; hasNextPage: SqlQuery } {
	const pageTable = identifier("page");
	const pageId = identifier("page.id");

	const nextOperator = pageMode === "next-below" ? fragment`<` : fragment`>`;
	const previousOperator =
		pageMode === "next-below" ? fragment`>` : fragment`<`;

	return {
		hasPreviousPage: fragment`exists (
			select ${pageId} from ${tableName} as ${pageTable}
			where ${pageId} ${previousOperator} ${tableId}
			order by ${order}
			limit 1
		)`,
		hasNextPage: fragment`exists (
			select ${pageId} from ${tableName} as ${pageTable}
			where ${pageId} ${nextOperator} ${tableId}
			order by ${order}
			limit 1
		)`,
	};
}
