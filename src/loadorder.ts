import { actions, util } from "vortex-api";
import { NEXUSMODS_ID } from "./common";
import { types } from "vortex-api";
import { selectors } from "vortex-api";
import LoadOrderPanel from './loadorder-infopanel';

const preSortBlue = util.toBlue(preSort);

async function preSort(api: types.IExtensionApi, items: types.ILoadOrderDisplayItem[], direction: types.SortType): Promise<types.ILoadOrderDisplayItem[]> {
    const mods = util.getSafe(api.getState(), ['persistent', 'mods', NEXUSMODS_ID], {});

    const loadOrder = items.map(mod => {
        const modInfo = mods[mod.id];
        let name = modInfo ? modInfo.attributes.customFileName ?? modInfo.attributes.logicalFileName ?? modInfo.attributes.name : mod.name;
        const paks = util.getSafe(modInfo.attributes, ['pakFiles'], []);
        if (paks.length > 1) name = name + ` (${paks.length} PAK files)`;

        return {
            id: mod.id,
            name,
            imgUrl: modInfo ? modInfo.attributes.pictureUrl : undefined
        }
    });

    return Promise.resolve(
        direction === 'descending' 
        ? loadOrder.reverse() 
        : loadOrder 
    )
}

function makePrefix(input) {
  let res = '';
  let rest = input;
  while (rest > 0) {
    res = String.fromCharCode(65 + (rest % 25)) + res;
    rest = Math.floor(rest / 25);
  }
  return util.pad(Number(res), 'A', 3);
}

function createPrefix(api: types.IExtensionApi, mod: types.IMod) {
  const state = api.getState();
  const gameId = selectors.activeGameId(state);
  if (gameId !== NEXUSMODS_ID) return null;
  const profile = selectors.activeProfile(state);
  const loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile?.id], {});
  const loKeys = Object.keys(loadOrder);
  const pos = loKeys.indexOf(mod.id);
  if (pos === -1) {
    return 'ZZZZ-';
  }

  return makePrefix(pos) + '-';
}

let previousLO: any | undefined = undefined;

// This uses the ILoadOrder interface, but it isn't exported from the Vortex API. 
function callback(api: types.IExtensionApi, loadOrder: any) {
    if (previousLO === undefined) previousLO = loadOrder;
    if (loadOrder === previousLO) return;
    api.store?.dispatch(actions.setDeploymentNecessary(NEXUSMODS_ID, true));
    previousLO = loadOrder;
}

function filter(mods: types.IMod[]) {
    return mods.filter(mod => mod.type === 'starwarsjedi-pak-modtype')
}

export default { 
  preSort: preSortBlue, 
  createPrefix, 
  callback, 
  infoPanel: LoadOrderPanel, 
  filter 
};