declare module "pg/lib/utils.js" {
	export function escapeIdentifier(input: string): string;
	export function escapeLiteral(input: string): string;
}
