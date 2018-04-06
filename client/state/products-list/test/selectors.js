/** @format */

/**
 * External dependencies
 */
import deepFreeze from 'deep-freeze';

/**
 * Internal dependencies
 */
import {
	getProductDisplayCost,
	isProductsListFetching,
	getDiscountedOrRegularPrice,
	planSlugToPlanProduct,
	computeFullAndMonthlyPricesForPlan,
	computeProductsWithPrices,
} from '../selectors';

import { getPlanDiscountedRawPrice } from 'state/sites/plans/selectors';
import { getPlanRawPrice } from 'state/plans/selectors';
import { getPlan } from 'lib/plans';
import { TERM_MONTHLY } from 'lib/plans/constants';

jest.mock( 'lib/abtest', () => ( {
	abtest: () => '',
} ) );

jest.mock( 'state/sites/plans/selectors', () => ( {
	getPlanDiscountedRawPrice: jest.fn(),
} ) );

jest.mock( 'lib/plans', () => ( {
	applyTestFiltersToPlansList: jest.fn( x => x ),
	getPlan: jest.fn(),
} ) );

jest.mock( 'state/plans/selectors', () => ( {
	getPlanRawPrice: jest.fn(),
} ) );

describe( 'selectors', () => {
	describe( '#getDiscountedOrRegularPrice()', () => {
		beforeEach( () => {
			getPlanDiscountedRawPrice.mockReset();
			getPlanDiscountedRawPrice.mockImplementation( () => 12 );

			getPlanRawPrice.mockReset();
			getPlanRawPrice.mockImplementation( () => 50 );
		} );

		test( 'Should return discounted price if available', () => {
			const plan = { getStoreSlug: () => 'abc' };
			expect( getDiscountedOrRegularPrice( {}, 1, plan ) ).toBe( 12 );
		} );

		test( 'Should pass correct arguments to getPlanDiscountedRawPrice', () => {
			const plan = { getStoreSlug: () => 'abc' };
			getDiscountedOrRegularPrice( { state: 1 }, 1, plan, false );
			expect( getPlanDiscountedRawPrice.mock.calls[ 0 ] ).toEqual( [
				{ state: 1 },
				1,
				'abc',
				{ isMonthly: false },
			] );
		} );

		test( 'Should return raw price if no discount available', () => {
			getPlanDiscountedRawPrice.mockImplementation( () => null );

			const plan = { getStoreSlug: () => 'abc', getProductId: () => 'def' };
			expect( getDiscountedOrRegularPrice( {}, 1, plan, false ) ).toBe( 50 );
		} );

		test( 'Should pass correct arguments to getPlanRawPrice', () => {
			getPlanDiscountedRawPrice.mockImplementation( () => null );

			const plan = { getStoreSlug: () => 'abc', getProductId: () => 'def' };
			getDiscountedOrRegularPrice( { state: 1 }, 1, plan, false );
			expect( getPlanRawPrice.mock.calls[ 0 ] ).toEqual( [ { state: 1 }, 'def', false ] );
		} );

		test( 'Should pass correct isMonthly value', () => {
			const plan = { getStoreSlug: () => 'abc', getProductId: () => 'def' };
			getDiscountedOrRegularPrice( {}, 1, plan, false );
			expect( getPlanDiscountedRawPrice.mock.calls[ 0 ][ 3 ] ).toEqual( { isMonthly: false } );

			getDiscountedOrRegularPrice( {}, 1, plan, true );
			expect( getPlanDiscountedRawPrice.mock.calls[ 1 ][ 3 ] ).toEqual( { isMonthly: true } );

			getDiscountedOrRegularPrice( {}, 1, { ...plan, term: TERM_MONTHLY }, true );
			expect( getPlanDiscountedRawPrice.mock.calls[ 2 ][ 3 ] ).toEqual( { isMonthly: false } );
		} );
	} );

	describe( '#planSlugToPlanProduct()', () => {
		test( 'Should return shape { planSlug, plan, product }', () => {
			const products = {
				myPlanSlug: {
					price: 10,
				},
			};
			const planSlug = 'myPlanSlug';
			const plan = {
				storeId: 15,
			};
			getPlan.mockImplementation( () => plan );

			expect( planSlugToPlanProduct( products, planSlug ) ).toEqual( {
				planSlug,
				plan,
				product: products.myPlanSlug,
			} );
		} );

		test( 'Should return shape { planSlug, plan, product } with empty values if plan or product couldnt be found', () => {
			const planSlug = 'myPlanSlug';
			getPlan.mockImplementation( () => null );

			expect( planSlugToPlanProduct( {}, planSlug ) ).toEqual( {
				planSlug,
				plan: null,
				product: undefined,
			} );

			expect( planSlugToPlanProduct( { myPlanSlug: null }, planSlug ) ).toEqual( {
				planSlug,
				plan: null,
				product: null,
			} );
		} );
	} );

	describe( '#computeFullAndMonthlyPricesForPlan()', () => {
		test( 'Should return shape { priceFull, priceMonthly }', () => {
			getPlanDiscountedRawPrice.mockImplementation(
				( a, b, c, { isMonthly } ) => ( isMonthly ? 10 : 120 )
			);

			const plan = { getStoreSlug: () => 'abc', getProductId: () => 'def' };
			expect( computeFullAndMonthlyPricesForPlan( {}, 1, plan ) ).toEqual( {
				priceFull: 120,
				priceMonthly: 10,
			} );
		} );
	} );

	describe( '#computeProductsWithPrices()', () => {
		const plans = {
			plan1: {
				id: 1,
				getStoreSlug: () => 'abc',
				getProductId: () => 'def',
			},

			plan2: {
				id: 2,
				getStoreSlug: () => 'jkl',
				getProductId: () => 'mno',
			},
		};

		beforeEach( () => {
			getPlanRawPrice.mockImplementation( () => 0 );
			getPlanDiscountedRawPrice.mockImplementation( ( a, b, storeSlug, { isMonthly } ) => {
				if ( storeSlug === 'abc' ) {
					return isMonthly ? 10 : 120;
				}

				return isMonthly ? 20 : 240;
			} );

			getPlan.mockImplementation( slug => plans[ slug ] );
		} );

		test( 'Should return list of shapes { priceFull, priceMonthly, plan, product, planSlug }', () => {
			const state = {
				productsList: {
					items: {
						plan1: { available: true },
						plan2: { available: true },
					},
				},
			};

			expect( computeProductsWithPrices( state, 10, [ 'plan1', 'plan2' ] ) ).toEqual( [
				{
					planSlug: 'plan2',
					plan: plans.plan2,
					product: state.productsList.items.plan2,
					priceFull: 240,
					priceMonthly: 20,
				},
				{
					planSlug: 'plan1',
					plan: plans.plan1,
					product: state.productsList.items.plan1,
					priceFull: 120,
					priceMonthly: 10,
				},
			] );
		} );

		test( 'Should filter out unavailable products', () => {
			const state = {
				productsList: {
					items: {
						plan1: { available: true },
						plan2: { available: false },
					},
				},
			};

			expect( computeProductsWithPrices( state, 10, [ 'plan1', 'plan2' ] ) ).toEqual( [
				{
					planSlug: 'plan1',
					plan: plans.plan1,
					product: state.productsList.items.plan1,
					priceFull: 120,
					priceMonthly: 10,
				},
			] );
		} );

		test( 'Should filter out unavailable not found products', () => {
			const state = {
				productsList: {
					items: {
						plan1: { available: true },
					},
				},
			};

			expect( computeProductsWithPrices( state, 10, [ 'plan1', 'plan2' ] ) ).toEqual( [
				{
					planSlug: 'plan1',
					plan: plans.plan1,
					product: state.productsList.items.plan1,
					priceFull: 120,
					priceMonthly: 10,
				},
			] );
		} );

		test( 'Should filter out unavailable not found products with no price', () => {
			getPlanDiscountedRawPrice.mockImplementation( ( a, b, storeSlug, { isMonthly } ) => {
				if ( storeSlug === 'abc' ) {
					return isMonthly ? 10 : 120;
				}
			} );

			const state = {
				productsList: {
					items: {
						plan1: { available: true },
						plan2: { available: true },
					},
				},
			};

			expect( computeProductsWithPrices( state, 10, [ 'plan1', 'plan2' ] ) ).toEqual( [
				{
					planSlug: 'plan1',
					plan: plans.plan1,
					product: state.productsList.items.plan1,
					priceFull: 120,
					priceMonthly: 10,
				},
			] );
		} );
	} );

	describe( '#getProductDisplayCost()', () => {
		test( 'should return null when the products list has not been fetched', () => {
			const state = deepFreeze( { productsList: { items: {} } } );

			expect( getProductDisplayCost( state, 'guided_transfer' ) ).toBe( null );
		} );

		test( 'should return the display cost', () => {
			const state = deepFreeze( {
				productsList: {
					items: {
						guided_transfer: {
							cost_display: 'A$169.00',
						},
					},
				},
			} );

			expect( getProductDisplayCost( state, 'guided_transfer' ) ).toBe( 'A$169.00' );
		} );
	} );

	describe( '#isProductsListFetching()', () => {
		test( 'should return false when productsList.isFetching is false', () => {
			const state = { productsList: { isFetching: false } };
			expect( isProductsListFetching( state ) ).toBe( false );
		} );

		test( 'should return true when productsList.isFetching is true', () => {
			const state = { productsList: { isFetching: true } };
			expect( isProductsListFetching( state ) ).toBe( true );
		} );
	} );
} );
