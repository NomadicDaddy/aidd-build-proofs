import {
	badRequestExample,
	conflictExample,
	dataExample,
	FORBIDDEN_EXAMPLE,
	notFoundExample,
	paginatedExample,
	UNAUTHORIZED_EXAMPLE,
} from '../constants/responseExamples.ts';

/** Example relationship payload shared by the OpenAPI docs. */
const EXAMPLE_RELATIONSHIP = {
	confidence: 'confirmed',
	createdAt: '2026-07-03T12:00:00.000Z',
	id: 1,
	isDeleted: false,
	notes: 'VM hosted on primary hypervisor',
	relationshipType: 'runs_on',
	sourceAssetId: 2,
	targetAssetId: 1,
};

const LIST_DETAIL = {
	description:
		'Returns a paginated, filterable list of directed asset relationships. Filter by a ' +
		'single asset (either endpoint), an explicit source or target, relationship type, and ' +
		'confidence. Soft-deleted edges are excluded unless includeDeleted=true. Requires ' +
		'VIEWER role or higher.',
	responses: {
		'200': {
			content: {
				'application/json': {
					examples: {
						success: paginatedExample('Relationship page', [EXAMPLE_RELATIONSHIP], 1),
					},
				},
			},
			description: 'Paginated list of relationships.',
		},
		'401': UNAUTHORIZED_EXAMPLE,
		'403': FORBIDDEN_EXAMPLE,
	},
	summary: 'List relationships (VIEWER+)',
};

const GET_DETAIL = {
	description:
		'Returns a single relationship by id. Soft-deleted edges are excluded unless ' +
		'includeDeleted=true. Requires VIEWER role or higher.',
	responses: {
		'200': {
			content: {
				'application/json': {
					examples: { success: dataExample('Relationship detail', EXAMPLE_RELATIONSHIP) },
				},
			},
			description: 'The requested relationship.',
		},
		'401': UNAUTHORIZED_EXAMPLE,
		'403': FORBIDDEN_EXAMPLE,
		'404': notFoundExample('Relationship'),
	},
	summary: 'Get a relationship by id (VIEWER+)',
};

const CREATE_DETAIL = {
	description:
		'Creates a directed relationship between two distinct assets. Both assets must exist ' +
		'and be active. Nonsensical edges (e.g. a storage volume that runs on a virtual ' +
		'machine) are rejected unless allowUnusual=true. Duplicate active edges of the same ' +
		'source/target/type are rejected. Emits a change event. Requires OPERATOR role or higher.',
	responses: {
		'201': {
			content: {
				'application/json': {
					examples: {
						success: dataExample('Created relationship', EXAMPLE_RELATIONSHIP),
					},
				},
			},
			description: 'The created relationship.',
		},
		'401': UNAUTHORIZED_EXAMPLE,
		'403': FORBIDDEN_EXAMPLE,
		'404': notFoundExample('Source asset'),
		'409': conflictExample('An identical active relationship already exists.'),
		'422': badRequestExample('A relationship must connect two different assets.'),
	},
	summary: 'Create a relationship (OPERATOR+)',
};

const UPDATE_DETAIL = {
	description:
		'Updates a relationship’s type, confidence, or notes. A changed type is re-validated ' +
		'for plausibility (unless allowUnusual=true) and for duplicates. Emits a change event. ' +
		'Requires OPERATOR role or higher.',
	responses: {
		'200': {
			content: {
				'application/json': {
					examples: {
						success: dataExample('Updated relationship', EXAMPLE_RELATIONSHIP),
					},
				},
			},
			description: 'The updated relationship.',
		},
		'401': UNAUTHORIZED_EXAMPLE,
		'403': FORBIDDEN_EXAMPLE,
		'404': notFoundExample('Relationship'),
		'409': conflictExample('An identical active relationship already exists.'),
		'422': badRequestExample('A "runs_on" relationship cannot target a ...'),
	},
	summary: 'Update a relationship (OPERATOR+)',
};

const DELETE_DETAIL = {
	description:
		'Soft-deletes a relationship (the edge can be recreated afterward). Emits a change ' +
		'event. Requires OPERATOR role or higher.',
	responses: {
		'200': {
			content: {
				'application/json': {
					examples: {
						success: dataExample('Soft-deleted relationship', {
							...EXAMPLE_RELATIONSHIP,
							isDeleted: true,
						}),
					},
				},
			},
			description: 'The soft-deleted relationship.',
		},
		'401': UNAUTHORIZED_EXAMPLE,
		'403': FORBIDDEN_EXAMPLE,
		'404': notFoundExample('Relationship'),
	},
	summary: 'Delete a relationship (OPERATOR+)',
};

export { CREATE_DETAIL, DELETE_DETAIL, GET_DETAIL, LIST_DETAIL, UPDATE_DETAIL };
