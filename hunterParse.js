/* eslint-disable no-console */
/* eslint-disable immutable/no-mutation */
/* Airbnb Hunter - find top rated Airbnb apartments */
const hunterURL = 'https://untit1ed.github.io/bnbSorting/';

async function getJSON(url) {
	return await fetch(url)
		.then((response) => {
			return response.json();
		});
}

function extractSection(json) {
	const sec = (json.explore_tabs[0].sections);
	return sec.find((o) => o.section_component_type === 'LISTINGS_GRID');
}

const exportable = [];
const uniqueIds = [];
const countByRange = {};
const itemsPerGrid = 50;

const dataState = JSON.parse(document.getElementById('data-state').innerHTML);
const apiKey = dataState.bootstrapData['layout-init'].api_config.key;


async function parsePriceRange(params) {
	console.log(`Parsing from ${params.min} to ${params.max}`);

	params.isAnythingLeft = true;
	params.itemsOffset = 0;

	while (params.isAnythingLeft) {
		const searchParams = new URLSearchParams(location.href.split('?')[1]);
		searchParams.set('items_per_grid', itemsPerGrid);
		searchParams.set('items_offset', params.itemsOffset);
		searchParams.set('key', apiKey);

		searchParams.set('price_min', params.min);
		searchParams.set('price_max', params.max);

		if (params.last_search_session_id)
			searchParams.set('last_search_session_id', params.last_search_session_id);

		if (params.federated_search_session_id)
			searchParams.set('federated_search_session_id', params.federated_search_session_id);

		// eslint-disable-next-line no-undef
		hunterParse.innerHTML = `Parsing page ${(params.itemsOffset / itemsPerGrid) + 1} range ${params.min}..${params.max}`;

		//console.log('Request listings: ', searchParams.toString());
		const json = await getJSON(`${location.origin}/api/v2/explore_tabs?${searchParams.toString()}`);
		// 17 pages * 18 = 306 results limit
		if (json.explore_tabs[0].home_tab_metadata.listings_count > 305) {
			const half = Math.round((params.max - params.min) / 2);

			console.log(`Bisect in half $${half}`);

			return await Promise.all([
				parsePriceRange(Object.assign({}, params, { max: params.min + half })),
				parsePriceRange(Object.assign({}, params, { min: params.min + half })),
			]);
		}

		countByRange[params.max] = json.explore_tabs[0].home_tab_metadata.listings_count;

		const section = extractSection(json);
		if (section.listings.length === 0) {
			console.log('Empty listings');
		}

		for (const listing of section.listings) {
			if (uniqueIds.indexOf(listing.listing.id) === -1) {
				// eslint-disable-next-line camelcase
				listing.listing.pricing_quote = listing.pricing_quote;
				exportable.push(listing.listing);

				uniqueIds.push(listing.listing.id);
			}
		}

		// repeat
		if (json.explore_tabs[0].pagination_metadata.has_next_page) {
			params.itemsOffset += itemsPerGrid;

			// eslint-disable-next-line camelcase
			params.last_search_session_id = section.search_session_id;
			// eslint-disable-next-line camelcase
			params.federated_search_session_id = json.metadata.federated_search_session_id;
		}
		else {
			// break loop
			params.isAnythingLeft = false;
		}

		// eslint-disable-next-line no-undef
		hunterExport.innerHTML = `Export - ${uniqueIds.length}`;
	}
}


async function initParse() {
	const href = new URLSearchParams(location.href.split('?')[1]);

	if (href.get('sw_lat') == null) {
		alert('Slightly move the map');
		return;
	}

	// set initial price range
	const min = Number(href.get('price_min'));
	const max = Number(href.get('price_max'));
	if (!max) {
		alert('Set price range');
		return;
	}

	await parsePriceRange({
		min: min ? min : 1,
		max,
		isAnythingLeft: true,
		itemsOffset: 0,
		// eslint-disable-next-line camelcase
		last_search_session_id: false,
		// eslint-disable-next-line camelcase
		federated_search_session_id: false,
		href,
	});

	// eslint-disable-next-line no-undef
	hunterParse.innerHTML = 'Parse';
};

function exportListings() {
	const remoteWindow = window.open(hunterURL);
	window.addEventListener('message', (e) => {
		if (e.data === 'ready') {
			console.log('exporting data');
			const jsonString = JSON.stringify({
				listings: exportable,
				href: location.href.split('?')[1],
			});
			console.log(jsonString);
			remoteWindow.postMessage(jsonString, '*');
		}
	});
}

const div = document.createElement('div');
div.innerHTML = `<div style='position:fixed;left:45%;top:0px;z-index:99999;background-color: bisque;  padding: 20px;'>
<a href='#' id='hunterParse'>Parse</a> |
<a href='#' id='hunterExport'>Export - 0</a>
</div>`;
document.body.appendChild(div);
// eslint-disable-next-line no-undef
hunterParse.onclick = initParse;
// eslint-disable-next-line no-undef
hunterExport.onclick = exportListings;
