import path from "path";
import { types, util } from 'vortex-api';
import { NEXUSMODS_ID, MOD_FILE_EXT } from './common';


async function test(files: string[], gameId: string): Promise<types.ISupportedResult> {
  // Make sure we're able to support this mod.
  let supported = (gameId === NEXUSMODS_ID) &&
    (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

async function install(api: types.IExtensionApi, files: string[]) {
  // The .pak file is expected to always be positioned in the mods directory we're going to disregard anything placed outside the root.
  const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT)!;
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);
  
  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file => 
    ((file.indexOf(rootPath) !== -1) 
    && (!file.endsWith(path.sep))));

  const pakFiles = files.filter(file => path.extname(file).toLowerCase() === MOD_FILE_EXT).map(pak => path.basename(pak));

  if (pakFiles.length > 1) return await Promise.resolve(choosePaksToInstall(api, pakFiles, files));

  const instructions: types.IInstruction[] = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substr(idx)),
    };
  });

  if (pakFiles.length) instructions.push({
    type: 'attribute',
    key: 'pakFiles',
    value: pakFiles
  });

  return Promise.resolve({ instructions });
}

async function choosePaksToInstall(api: types.IExtensionApi, paks: string[], allFiles: string[]): Promise<types.IInstallResult> {
  if (!api.showDialog) throw new Error('Unable to display PAK selection dialogue due to Vortex API changes.');

  try {
    const checkboxes = paks.map((p, i) => ({ id: p, text: p, value: i === 0 }));
    const userChoice = await api.showDialog(
      'question', 
      'Multiple PAK files', 
      {
        text: `The mod you are installing contains ${paks.length} PAK files.`
          + `This can be because the author intended for you to chose one of several options. Please select which files to install below:`,
        checkboxes
      },
      [
        { label: 'Cancel' },
        { label: 'Install Selected' },
        { label: 'Install All_plural' }
      ]
    );
    const { action, input }: { action: string, input: { [key: string]: boolean } } = userChoice;
    if (action === 'Cancel') return Promise.reject( new util.ProcessCanceled('User cancelled.') );
    const shouldInstallAll = (action === 'Install All' || action === 'Install All_plural');
    const paksToInstall = shouldInstallAll ? paks : Object.keys(input).filter(k => input[k]);

    const instructions: types.IInstruction[] = paksToInstall.map(pak => {
      const base = path.basename(pak, '.pak').toLowerCase();
      const relatedFiles = allFiles.filter(f => path.basename(f).toLowerCase().startsWith(base));
      const subInstructions: types.IInstruction[] = relatedFiles.map(rf => ({ type: 'copy', source: rf, destination: rf }))
      return subInstructions;
    }).flat();

    instructions.push({
      type: "attribute",
      key: 'pakFiles',
      value: paksToInstall
    });

    return Promise.resolve({ instructions });

  }
  catch(e: unknown){
    return Promise.reject( new util.DataInvalid(`Unexpected Error ${(e as Error)?.message}`) );
  }
}

export default { test, install };