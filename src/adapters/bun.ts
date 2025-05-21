import { sql, type SQLQuery } from "bun";
import type { PaginateOptions, PaginateResult } from "../paginate.ts";
import type { AdapterResult } from "./index.ts";

export function bunAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<SQLQuery> {
	let cursor = sql`1`;
	const sql_ = sqlOrLiteral(options);
	const filter = applyFilter(result.filter, sql_);
	const order = applyOrder(result.order, sql_);
	let hasNextPage = sql`false`;
	let hasPreviousPage = sql`false`;

	if (result.cursor.length > 2) {
		throw new Error("No support for more than 1 column ordering");
	}

	const [firstCursor, secondCursor] = result.cursor;
	if (firstCursor !== undefined && secondCursor !== undefined) {
		cursor = sql`${sql_(firstCursor)} || ',' || ${sql_(secondCursor)}`;
	} else if (firstCursor !== undefined) {
		cursor = sql`${sql_(firstCursor)}`;
	}

	if (result.hasNextPage !== undefined) {
		hasNextPage = sql`exists (
			select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
			where ${applyFilter(result.hasNextPage.filter, sql_)}
			order by ${applyOrder(result.hasNextPage.order, sql_)}
			limit 1
		)`;
	}

	if (result.hasPreviousPage !== undefined) {
		hasPreviousPage = sql`exists (
			select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
			where ${applyFilter(result.hasPreviousPage.filter, sql_)}
			order by ${applyOrder(result.hasPreviousPage.order, sql_)}
			limit 1
		)`;
	}

	return {
		cursor,
		filter,
		order,
		hasNextPage,
		hasPreviousPage,
	};
}

function applyFilter(filter: PaginateResult["filter"], sql_: Sql_): SQLQuery {
	if (filter === undefined) {
		return sql`1 = 1`;
	}

	const { left, right, operator } = filter;
	if (left.length === 1 && right.length === 1) {
		if (operator === ">") {
			return sql`${sql_(left[0])} > ${sql_(right[0])}`;
		}

		return sql`${sql_(left[0])} < ${sql_(right[0])}`;
	}

	if (left.length === 2 && right.length === 2) {
		if (operator === ">") {
			return sql`(${sql_(left[0])}, ${sql_(left[1])}) > (${sql_(right[0])}, ${sql_(right[1])})`;
		}

		return sql`(${sql_(left[0])}, ${sql_(left[1])}) < (${sql_(right[0])}, ${sql_(right[1])})`;
	}

	throw new Error("No support for more than 1 column ordering");
}

// this is used as with bun, we should pass identifiers as `${sql(identifier)}` and values as `${value}`
type Sql_ = (input: string | undefined) => SQLQuery | string;
function sqlOrLiteral(options: PaginateOptions): Sql_ {
	const allLiterals = [
		options.tableName,
		"id",
		`${options.tableName}.id`,
		"subquery",
		"subquery.id",
	];

	if (options.orderBy !== undefined) {
		allLiterals.push(
			options.orderBy?.column,
			`${options.tableName}.${options.orderBy?.column}`,
			`subquery.${options.orderBy?.column}`,
		);
	}

	return (input: string | undefined): SQLQuery | string => {
		if (input === undefined) {
			throw new Error("No support for undefined");
		}

		if (allLiterals.includes(input)) {
			return sql(input);
		}

		return input;
	};
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: not _really_ complex
function applyOrder(order: PaginateResult["order"], sql_: Sql_): SQLQuery {
	if (order.length > 2) {
		throw new Error("No support for more than 1 column ordering");
	}

	const [firstOrder, secondOrder] = order;
	if (firstOrder !== undefined && secondOrder !== undefined) {
		if (firstOrder.order === "asc" && secondOrder.order === "asc") {
			return sql`${sql_(firstOrder.column)} asc, ${sql_(secondOrder.column)} asc`;
		}
		if (firstOrder.order === "asc" && secondOrder.order === "desc") {
			return sql`${sql_(firstOrder.column)} asc, ${sql_(secondOrder.column)} desc`;
		}
		if (firstOrder.order === "desc" && secondOrder.order === "asc") {
			return sql`${sql_(firstOrder.column)} desc, ${sql_(secondOrder.column)} asc`;
		}
		if (firstOrder.order === "desc" && secondOrder.order === "desc") {
			return sql`${sql_(firstOrder.column)} desc, ${sql_(secondOrder.column)} desc`;
		}
	}

	if (firstOrder !== undefined) {
		if (firstOrder.order === "asc") {
			return sql`${sql_(firstOrder.column)} asc`;
		}
		if (firstOrder.order === "desc") {
			return sql`${sql_(firstOrder.column)} desc`;
		}
	}

	throw new Error("No support for more than 1 column ordering");
}
