import type { PaginateResult } from "../index.ts";

export interface PaginationQueryData {
	cursor: string;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

export async function paginationTestData<
	Sql extends (...args: unknown[]) => unknown,
	SqlQuery,
>(
	sql: Sql,
	rawTableName: string,
): Promise<
	(
		settings: PaginateResult<SqlQuery>,
	) => Promise<
		{ cursor: string; hasNextPage: boolean; hasPreviousPage: boolean }[]
	>
> {
	const tableName = sql(rawTableName);

	await sql`
		create table if not exists ${tableName} (
			"id" uuid primary key,
			"name" text not null,
			"path" text not null,
			"scan_interval" integer not null,
			"created_at" timestamp with time zone not null
		)
	`;

	await sql`
		insert into ${tableName}
			("id", "name", "path", "scan_interval", "created_at")
		values
			('00000001-0000-0001-0000-000000000001', 'AAAA', '/Users/AAAA', 3600, '2025-05-09 10:11:00.000+00'),
			('00000001-0000-0002-0000-000000000002', 'BBBB', '/Users/BBBB', 3600, '2025-05-09 10:11:01.000+00'),
			('00000001-0000-0003-0000-000000000003', 'CCCC', '/Users/CCCC', 3600, '2025-05-09 10:11:02.000+00'),
			('00000001-0000-0004-0000-000000000004', 'DDDD', '/Users/DDDD', 3600, '2025-05-09 10:11:03.000+00'),
			('00000001-0000-0005-0000-000000000005', 'EEEE', '/Users/EEEE', 3600, '2025-05-09 10:11:04.000+00'),
			('00000001-0000-0006-0000-000000000006', 'FFFF', '/Users/FFFF', 3600, '2025-05-09 10:11:05.000+00'),
			('00000001-0000-0007-0000-000000000007', 'GGGG', '/Users/GGGG', 3600, '2025-05-09 10:11:06.000+00'),
			('00000001-0000-0008-0000-000000000008', 'HHHH', '/Users/HHHH', 3600, '2025-05-09 10:11:07.000+00'),
			('00000001-0000-0009-0000-000000000009', 'IIII', '/Users/IIII', 3600, '2025-05-09 10:11:08.000+00')
	`;

	return async (
		settings: PaginateResult<SqlQuery>,
	): Promise<
		{ cursor: string; hasNextPage: boolean; hasPreviousPage: boolean }[]
	> => {
		return (await sql`
			select
				${settings.cursor},
				${settings.hasNextPage} as "hasNextPage",
				${settings.hasPreviousPage} as "hasPreviousPage"
			from ${tableName}
			where ${settings.filter}
			order by ${settings.order}
			limit 3
		`) as Promise<
			{ cursor: string; hasNextPage: boolean; hasPreviousPage: boolean }[]
		>;
	};
}
