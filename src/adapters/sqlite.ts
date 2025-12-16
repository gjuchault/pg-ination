import type { AdapterResult } from "../index.ts";
import type {
	Filter,
	Order,
	PaginateOptions,
	PaginateResult,
} from "../paginate.ts";
import { escapeIdentifier, escapeLiteral } from "./base-pg/index.ts";

export function sqliteAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<string> {
	let cursor = `'1'`;
	const sql_ = sqlOrLiteral(options);

	const filter = applyFilter(result.filter, sql_, true);
	const order = applyOrder(result.order, sql_);
	let hasNextPage = "false";
	let hasPreviousPage = "false";

	if (result.cursor.length > 2) {
		throw new Error("No support for more than 1 column ordering");
	}

	const [firstCursor, secondCursor] = result.cursor;
	if (firstCursor !== undefined && secondCursor !== undefined) {
		cursor = `coalesce(${sql_(firstCursor)} || ',', '') || ${sql_(secondCursor)}`;
	} else if (firstCursor !== undefined) {
		cursor = `${sql_(firstCursor)}`;
	}

	if (result.hasNextPage !== undefined) {
		hasNextPage = `exists (
			select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
			where ${applyFilters(result.hasNextPage.filters, sql_)}
			order by ${applyOrder(result.hasNextPage.order, sql_)}
			limit 1
		)`;

		if (result.hasNextPageNullColumn !== undefined) {
			hasNextPage = `(${hasNextPage} or exists (
				select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
				where ${applyFilters(result.hasNextPageNullColumn.filters, sql_)}
				order by ${applyOrder(result.hasNextPageNullColumn.order, sql_)}
				limit 1
			))`;
		}
	}

	if (result.hasPreviousPage !== undefined) {
		hasPreviousPage = `exists (
			select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
			where ${applyFilters(result.hasPreviousPage.filters, sql_)}
			order by ${applyOrder(result.hasPreviousPage.order, sql_)}
			limit 1
		)`;

		if (result.hasPreviousPageNullColumn !== undefined) {
			hasPreviousPage = `(${hasPreviousPage} or exists (
				select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
				where ${applyFilters(result.hasPreviousPageNullColumn.filters, sql_)}
				order by ${applyOrder(result.hasPreviousPageNullColumn.order, sql_)}
				limit 1
			))`;
		}
	}

	return {
		cursor,
		filter,
		order,
		hasNextPage,
		hasPreviousPage,
	};
}

function applyFilter(
	filter: Filter | undefined,
	sql_: Sql_,
	coalesceNulls = false,
): string {
	if (filter === undefined) {
		return "true";
	}

	if (filter.operator === "is not null") {
		return `${sql_(filter.left[0])} is not null`;
	}

	if (filter.operator === "is null") {
		return `${sql_(filter.left[0])} is null`;
	}

	if (filter.operator === ">" || filter.operator === "<") {
		const { left, right, operator } = filter;
		if (left.length === 1 && right.length === 1) {
			if (operator === ">") {
				return `${sql_(left[0])} > ${sql_(right[0])}`;
			}

			return `${sql_(left[0])} < ${sql_(right[0])}`;
		}

		if (left.length === 2 && right.length === 2) {
			if (operator === ">") {
				if (coalesceNulls) {
					const right0 = (right[0] ?? "").length === 0 ? "1" : right[0];
					return `(${sql_(left[0], or1)}, ${sql_(left[1])}) > (${sql_(right0, or1)}, ${sql_(right[1])})`;
				}
				return `(${sql_(left[0])}, ${sql_(left[1])}) > (${sql_(right[0])}, ${sql_(right[1])})`;
			}

			if (coalesceNulls) {
				const right0 = (right[0] ?? "").length === 0 ? "1" : right[0];
				return `(${sql_(left[0], or1)}, ${sql_(left[1])}) < (${sql_(right0, or1)}, ${sql_(right[1])})`;
			}
			return `(${sql_(left[0])}, ${sql_(left[1])}) < (${sql_(right[0])}, ${sql_(right[1])})`;
		}

		throw new Error("No support for more than 1 column ordering");
	}

	throw new Error("No support for this filter");
}

function applyFilters(filters: Filter[], sql_: Sql_): string {
	return filters.map((filter) => applyFilter(filter, sql_)).join(" and ");
}

function or1(input: string) {
	return `coalesce(cast(${input} as text), '1')`;
}

// this is used as with bun, we should pass identifiers as `${sql(identifier)}` and values as `${value}`
type Sql_ = (
	input: string | undefined,
	wrapper?: (input: string) => string,
) => string;

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

	return function sql_(
		input: string | undefined,
		wrapper: (input: string) => string = (input) => input,
	): string {
		if (input === undefined) {
			throw new Error("No support for undefined");
		}

		if (allLiterals.includes(input)) {
			return wrapper(
				input
					.split(".")
					.map((i) => escapeIdentifier(i))
					.join("."),
			);
		}

		return wrapper(escapeLiteral(input));
	};
}

function applyOrder(order: Order[], sql_: Sql_): string {
	if (order.length > 2) {
		throw new Error("No support for more than 1 column ordering");
	}

	const [firstOrder, secondOrder] = order;
	if (firstOrder !== undefined && secondOrder !== undefined) {
		if (firstOrder.order === "asc" && secondOrder.order === "asc") {
			return `${sql_(firstOrder.column)} asc, ${sql_(secondOrder.column)} asc`;
		}
		if (firstOrder.order === "asc" && secondOrder.order === "desc") {
			return `${sql_(firstOrder.column)} asc, ${sql_(secondOrder.column)} desc`;
		}
		if (firstOrder.order === "desc" && secondOrder.order === "asc") {
			return `${sql_(firstOrder.column)} desc, ${sql_(secondOrder.column)} asc`;
		}
		if (firstOrder.order === "desc" && secondOrder.order === "desc") {
			return `${sql_(firstOrder.column)} desc, ${sql_(secondOrder.column)} desc`;
		}
	}

	if (firstOrder !== undefined) {
		if (firstOrder.order === "asc") {
			return `${sql_(firstOrder.column)} asc`;
		}
		if (firstOrder.order === "desc") {
			return `${sql_(firstOrder.column)} desc`;
		}
	}

	throw new Error("No support for more than 1 column ordering");
}
