import type {
	Filter,
	Order,
	PaginateOptions,
	PaginateResult,
} from "../../paginate.ts";
import type { AdapterResult } from "../index.ts";

// ported from pg/lib/utils.js
export function escapeIdentifier(str: string): string {
	return `"${str.replace(/"/g, '""')}"`;
}

// ported from pg/lib/utils.js
export function escapeLiteral(str: string): string {
	let hasBackslash = false;
	let escaped = "'";

	if (str == null) {
		return "''";
	}

	if (typeof str !== "string") {
		return "''";
	}

	for (let i = 0; i < str.length; i++) {
		const c = str[i];
		if (c === "'") {
			escaped += c + c;
		} else if (c === "\\") {
			escaped += c + c;
			hasBackslash = true;
		} else {
			escaped += c;
		}
	}

	escaped += "'";

	if (hasBackslash === true) {
		escaped = ` E${escaped}`;
	}

	return escaped;
}

export function basePgAdapter(
	options: PaginateOptions,
	result: PaginateResult,
): AdapterResult<string> {
	let cursor = `'1'`;
	const sql_ = sqlOrLiteral(options);

	const firstOrderType = options.orderBy?.type ?? "text";
	const filter = applyFilter(result.filter, sql_, true, firstOrderType);
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
		const hasNextPageOrderType = result.hasNextPage.order[0]?.type ?? "text";
		hasNextPage = `exists (
			select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
			where ${applyFilters(result.hasNextPage.filters, sql_, hasNextPageOrderType)}
			order by ${applyOrder(result.hasNextPage.order, sql_)}
			limit 1
		)`;

		if (result.hasNextPageNullColumn !== undefined) {
			const hasNextPageNullColumnOrderType =
				result.hasNextPageNullColumn.order[0]?.type ?? "text";
			hasNextPage = `(${hasNextPage} or exists (
				select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
				where ${applyFilters(result.hasNextPageNullColumn.filters, sql_, hasNextPageNullColumnOrderType)}
				order by ${applyOrder(result.hasNextPageNullColumn.order, sql_)}
				limit 1
			))`;
		}
	}

	if (result.hasPreviousPage !== undefined) {
		const hasPreviousPageOrderType =
			result.hasPreviousPage.order[0]?.type ?? "text";
		hasPreviousPage = `exists (
			select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
			where ${applyFilters(result.hasPreviousPage.filters, sql_, hasPreviousPageOrderType)}
			order by ${applyOrder(result.hasPreviousPage.order, sql_)}
			limit 1
		)`;

		if (result.hasPreviousPageNullColumn !== undefined) {
			const hasPreviousPageNullColumnOrderType =
				result.hasPreviousPageNullColumn.order[0]?.type ?? "text";
			hasPreviousPage = `(${hasPreviousPage} or exists (
				select "subquery"."id" from ${sql_(options.tableName)} as ${sql_("subquery")}
				where ${applyFilters(result.hasPreviousPageNullColumn.filters, sql_, hasPreviousPageNullColumnOrderType)}
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
	orderType: "numeric" | "text" | "timestamp",
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
					const right0 =
						(right[0] ?? "").length === 0 ? "1" : (right[0] ?? "1");
					return `(${sql_(left[0], or1ForType(orderType))}, ${sql_(left[1])}) > (${or1ForTypeValue(right0, orderType, sql_)}, ${sql_(right[1])})`;
				}
				return `(${sql_(left[0])}, ${sql_(left[1])}) > (${sql_(right[0])}, ${sql_(right[1])})`;
			}

			if (coalesceNulls) {
				const right0 = (right[0] ?? "").length === 0 ? "1" : (right[0] ?? "1");
				return `(${sql_(left[0], or1ForType(orderType))}, ${sql_(left[1])}) < (${or1ForTypeValue(right0, orderType, sql_)}, ${sql_(right[1])})`;
			}
			return `(${sql_(left[0])}, ${sql_(left[1])}) < (${sql_(right[0])}, ${sql_(right[1])})`;
		}

		throw new Error("No support for more than 1 column ordering");
	}

	throw new Error("No support for this filter");
}

function applyFilters(
	filters: Filter[],
	sql_: Sql_,
	orderType: "numeric" | "text" | "timestamp",
): string {
	return filters
		.map((filter) => applyFilter(filter, sql_, false, orderType))
		.join(" and ");
}
function or1ForType(
	type: "numeric" | "text" | "timestamp",
): (input: string) => string {
	if (type === "numeric") {
		return (input: string) => `coalesce(${input}, 1)`;
	}
	if (type === "timestamp") {
		return (input: string) =>
			`coalesce(${input}, '1970-01-01'::timestamp with time zone)`;
	}
	return (input: string) => `coalesce(${input}, '1')`;
}

function or1ForTypeValue(
	input: string,
	type: "numeric" | "text" | "timestamp",
	sql_: Sql_,
): string {
	if (type === "numeric") {
		return `coalesce(${sql_(input)}::numeric, 1)`;
	}
	if (type === "timestamp") {
		return `coalesce(${sql_(input)}::timestamp with time zone, '1970-01-01'::timestamp with time zone)`;
	}
	return `coalesce(${sql_(input)}, '1')`;
}

// this is used since in bun, we should pass identifiers as `${sql(identifier)}` and values as `${value}`
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
