export type Paginated<T> = {
	data: T[];
	nextPageCursor?: string | undefined;
	previousPageCursor?: string | undefined;
};

export type PaginateResult<SqlQuery> = {
	cursor: SqlQuery;
	filter: SqlQuery;
	order: SqlQuery;
	hasNextPage: SqlQuery;
	hasPreviousPage: SqlQuery;
};

type PageMode =
	| ["next-below", "same-order"] // (id desc, after) or (name desc, after)
	| ["next-above", "same-order"] // (name asc, after)
	| ["next-below", "reversed-order"] // (id desc, before) or (name desc, before)
	| ["next-above", "reversed-order"]; // (name asc, before)

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
}: {
	tableName: string;
	pagination?: { after: string } | { before: string } | undefined;
	orderBy?: { column: string; order: "asc" | "desc" } | undefined;
	identifier: (column: string) => SqlIdentifier;
	fragment: Sql;
}): PaginateResult<SqlQuery> {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	const tableName = identifier(rawTableName);
	const tableId = identifier(`${rawTableName}.id`);

	let filter = fragment`1 = 1`;
	let cursor = fragment`${tableId} as "cursor"`;
	let order = fragment`${tableId} desc`;
	let reversedOrder = fragment`${tableId} asc`;
	let pageMode: PageMode = ["next-below", "same-order"];

	if (orderBy?.order === "asc") {
		({ cursor, filter, order, reversedOrder, pageMode } = handleAscendingOrder<
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
		({ cursor, filter, order, reversedOrder, pageMode } = handleDescendingOrder<
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
		filter = fragment`${tableId} > ${pagination.before}::uuid`;
	}

	const { hasPreviousPage, hasNextPage } = getPagesExistence({
		tableName,
		tableId,
		pageMode,
		order,
		reversedOrder,
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
	reversedOrder: SqlQuery;
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter = fragment`1 = 1`;

	const tableColumn = identifier(`${rawTableName}.${orderByColumn}`);
	const cursor = fragment`(${tableId} || ',' || ${tableColumn}) as "cursor"`;
	const order = fragment`${tableColumn} desc, ${tableId} desc`;
	const reversedOrder = fragment`${tableColumn} asc, ${tableId} asc`;
	let pageMode: PageMode = ["next-below", "same-order"];

	if (isAfter) {
		const { id, column } = getCursorComparator(pagination.after);
		filter = fragment`(${tableColumn}, ${tableId}) < (${column}, ${id})`;
	} else if (isBefore) {
		const { id, column } = getCursorComparator(pagination.before);
		filter = fragment`(${tableColumn}, ${tableId}) > (${column}, ${id})`;
		pageMode = ["next-below", "reversed-order"];
	}

	return {
		cursor,
		filter,
		order,
		reversedOrder,
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
	reversedOrder: SqlQuery;
	pageMode: PageMode;
} {
	const isAfter = pagination !== undefined && "after" in pagination;
	const isBefore = pagination !== undefined && "before" in pagination;

	let filter = fragment`1 = 1`;

	const tableColumn = identifier(`${rawTableName}.${orderByColumn}`);
	const cursor = fragment`(${tableId} || ',' || ${tableColumn}) as "cursor"`;
	const order = fragment`${tableColumn} asc, ${tableId} asc`;
	const reversedOrder = fragment`${tableColumn} desc, ${tableId} desc`;

	let pageMode: PageMode = ["next-above", "same-order"];

	if (isAfter) {
		const { id, column } = getCursorComparator(pagination.after);
		filter = fragment`(${tableColumn}, ${tableId}) > (${column}, ${id})`;
	} else if (isBefore) {
		const { id, column } = getCursorComparator(pagination.before);
		filter = fragment`(${tableColumn}, ${tableId}) < (${column}, ${id})`;
		pageMode = ["next-above", "reversed-order"];
	}

	return {
		cursor,
		filter,
		order,
		reversedOrder,
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
	reversedOrder,
	identifier = (column) => column as SqlIdentifier,
	fragment = ((column) => column) as Sql,
}: {
	tableName: SqlIdentifier;
	tableId: SqlIdentifier;
	pageMode: PageMode;
	order: SqlQuery;
	reversedOrder: SqlQuery;
	identifier?: (column: string) => SqlIdentifier;
	fragment?: Sql;
}): { hasPreviousPage: SqlQuery; hasNextPage: SqlQuery } {
	const pageTable = identifier("page");
	const pageId = identifier("page.id");

	const nextOperator = pageMode[0] === "next-below" ? fragment`<` : fragment`>`;
	const previousOperator =
		pageMode[0] === "next-below" ? fragment`>` : fragment`<`;
	const appliedOrder = pageMode[1] === "same-order" ? order : reversedOrder;

	return {
		hasPreviousPage: fragment`exists (
			select ${pageId} from ${tableName} as ${pageTable}
			where ${pageId} ${previousOperator} ${tableId}
			order by ${appliedOrder}
			limit 1
		)`,
		hasNextPage: fragment`exists (
			select ${pageId} from ${tableName} as ${pageTable}
			where ${pageId} ${nextOperator} ${tableId}
			order by ${appliedOrder}
			limit 1
		)`,
	};
}
