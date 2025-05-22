import type { PaginateOptions } from "../../paginate.ts";

export interface PaginationQueryData {
	cursor: string;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

export type TestDataQuery<T extends string> = (
	options: PaginateOptions,
	extraField?: T,
) => Promise<
	({ [Key in T]: string } & {
		cursor: string;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	})[]
>;

export async function paginationTestData<Fragment, Identifier>({
	sql,
	tableName,
}: {
	sql: (
		query: TemplateStringsArray,
		...args: (Fragment | Identifier)[]
	) => Promise<unknown>;
	tableName: Identifier;
}): Promise<void> {
	await sql`
		create table if not exists ${tableName} (
			"id" uuid primary key,
			"name" text not null,
			"created_at" timestamp with time zone not null
		)
	`;

	await sql`
		insert into ${tableName}
			("id", "name", "created_at")
		values
			('00000001-0000-0001-0000-000000000001', 'AAAA', '2025-05-09 10:11:00.000+00'),
			('00000001-0000-0002-0000-000000000002', 'BBBB', '2025-05-09 10:11:01.000+00'),
			('00000001-0000-0003-0000-000000000003', 'CCCC', '2025-05-09 10:11:02.000+00'),
			('00000001-0000-0004-0000-000000000004', 'DDDD', '2025-05-09 10:11:03.000+00'),
			('00000001-0000-0005-0000-000000000005', 'EEEE', '2025-05-09 10:11:04.000+00'),
			('00000001-0000-0006-0000-000000000006', 'FFFF', '2025-05-09 10:11:05.000+00'),
			('00000001-0000-0007-0000-000000000007', 'GGGG', '2025-05-09 10:11:06.000+00'),
			('00000001-0000-0008-0000-000000000008', 'HHHH', '2025-05-09 10:11:07.000+00'),
			('00000001-0000-0009-0000-000000000009', 'IIII', '2025-05-09 10:11:08.000+00')
		on conflict do nothing
	`;
}
