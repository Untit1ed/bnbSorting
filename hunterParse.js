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

var exportable = [];
var unique_ids = [];
var count_by_range = {};
var items_per_grid = 50;

var dataState = JSON.parse(document.getElementById('data-state').innerHTML);
var api_key = dataState.bootstrapData['layout-init'].api_config.key;


async function parsePriceRange(c) {
	console.log('Parsing from ' + c.min + ' to ' + c.max);

	c.anything_left = true
	c.items_offset = 0

	while (c.anything_left) {
		const searchParams = new URLSearchParams(location.href.split('?')[1]);
		searchParams.set('items_per_grid', items_per_grid);
		searchParams.set('items_offset', c.items_offset);
		searchParams.set('key', api_key);

		searchParams.set('price_min', c.min);
		searchParams.set('price_max', c.max);

		if (c.last_search_session_id)
			searchParams.set('last_search_session_id', c.last_search_session_id);

		if (c.federated_search_session_id)
			searchParams.set('federated_search_session_id', c.federated_search_session_id);

		hunterParse.innerHTML = `Parsing page ` + ((c.items_offset / items_per_grid) + 1) + ' range ' + c.min + '..' + c.max

		//console.log('Request listings: ', searchParams.toString());
		const json = await getJSON(`${location.origin}/api/v2/explore_tabs?${searchParams.toString()}`);
		// 17 pages * 18 = 306 results limit
		if (json.explore_tabs[0].home_tab_metadata.listings_count > 305) {
			const half = Math.round((c.max - c.min) / 2);

			console.log('Bisect in half $' + half);

			return await Promise.all([
				parsePriceRange(Object.assign({}, c, { max: c.min + half })),
				parsePriceRange(Object.assign({}, c, { min: c.min + half })),
			]);
		}

		count_by_range[c.max] = json.explore_tabs[0].home_tab_metadata.listings_count;

		var section = extractSection(json);
		if (section.listings.length > 0) {
			for (let listing of section.listings) {
				if (unique_ids.indexOf(listing.listing.id) == -1) {
					listing.listing.pricing_quote = listing.pricing_quote;
					exportable.push(listing.listing);

					unique_ids.push(listing.listing.id);
				}
			}
		}
		else {
			console.log('Empty listings');
		}

		// repeat
		if (json.explore_tabs[0].pagination_metadata.has_next_page) {
			c.items_offset += items_per_grid;

			c.last_search_session_id = section.search_session_id;
			c.federated_search_session_id = json.metadata.federated_search_session_id;
		}
		else {
			// break loop
			c.anything_left = false;
		}

		hunterExport.innerHTML = `Export - ` + unique_ids.length;
	}
}


async function initParse() {
	const c = {
		anything_left: true,
		items_offset: 0,
		last_search_session_id: false,
		federated_search_session_id: false,
		href: new URLSearchParams(location.href.split('?')[1]),
	};

	if (c.href.get('sw_lat') == null) {
		alert('Slightly move the map');
		return;
	}

	// set initial price range
	c.min = Number(c.href.get('price_min'));
	c.max = Number(c.href.get('price_max'));

	if (!c.min) c.min = 1;

	if (!c.max) {
		alert('Set price range');
		return;
	}

	await parsePriceRange(c);
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

var div = document.createElement('div');
div.innerHTML = `<div style='position:fixed;left:45%;top:0px;z-index:99999;background-color: bisque;  padding: 20px;'>
<a href='#' id='hunterParse'>Parse</a> |
<a href='#' id='hunterExport'>Export - 0</a>
</div>`;
document.body.appendChild(div);
hunterParse.onclick = initParse;
hunterExport.onclick = exportListings;
