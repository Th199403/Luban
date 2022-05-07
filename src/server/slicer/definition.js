import fs from 'fs';
import path from 'path';
import { includes, isNil } from 'lodash';
import DataStorage from '../DataStorage';
import pkg from '../../package.json';
import logger from '../lib/logger';
import { ConfigV1Regex, ConfigV1Suffix } from '../constants';

const log = logger('service:definition');

const SETTING_FIELDS = [
    'label', 'description', 'type', 'options', 'unit', 'enabled', 'default_value', 'value', 'enabled',
    'min', 'max',
    // Snapmaker extended fields:
    'sm_value'
];


const DEFAULT_PREDEFINED = {
    'printing': [
        'quality.fast_print.def.json',
        'quality.normal_quality.def.json',
        'quality.high_quality.def.json',
        'material.pla.def.json',
        'material.pla.black.def.json',
        'material.pla.blue.def.json',
        'material.pla.grey.def.json',
        'material.pla.red.def.json',
        'material.pla.yellow.def.json',
        'material.abs.def.json',
        'material.abs.black.def.json',
        'material.petg.def.json',
        'material.petg.black.def.json',
        'material.petg.red.def.json',
        'material.petg.blue.def.json',
        'material.pla.wood.def.json',
        'material.pla.glow.def.json',
        'material.tpu.black.def.json',
        'material.tpu.yellow.def.json'
    ],
    'cnc': [
        'tool.default_CVbit.def.json',
        'tool.default_FEM1.5.def.json',
        'tool.default_FEM3.175.def.json',
        'tool.default_MBEM.def.json',
        'tool.default_SGVbit.def.json',
        'tool.rAcrylic_FEM1.5.def.json',
        'tool.rEpoxy_SGVbit.def.json'
    ],
    'laser': [
        'present.default_CUT.def.json',
        'present.default_HDFill.def.json',
        'present.default_SDFill.def.json',
        'present.default_PathEngrave.def.json',
        'basswood.cutting_1.5mm.def.json',
        'basswood.dot_filled_engraving.def.json',
        'black_acrylic.cutting_3mm.def.json',
        'mdf.dot_filled_engraving.def.json',
        'basswood.line_filled_engraving.def.json',
        'mdf.line_filled_engraving.def.json',
        'basswood.vector_engraving.def.json',
        'mdf.vector_engraving.def.json'
    ],
    '10w-laser': [
        'basswood.cutting_1.5mm.def.json',
        'basswood.cutting_3mm.def.json',
        'basswood.cutting_5mm.def.json',
        'basswood.cutting_8mm.def.json',
        'basswood.vector_engraving.def.json',
        'basswood.dot_filled_engraving.def.json',
        'basswood.line_filled_engraving.def.json',
        'black_acrylic.cutting_2mm.def.json',
        'black_acrylic.cutting_3mm.def.json',
        'black_acrylic.cutting_5mm.def.json',
        'black_anodized_aluminum.line_filled_engraving.def.json',
        'black_anodized_aluminum.vector_engraving.def.json',
        'cardstock.cutting_200g.def.json',
        'cardstock.cutting_300g.def.json',
        'cardstock.cutting_350g.def.json',
        'coated_paper.cutting_200g.def.json',
        'coated_paper.cutting_300g.def.json',
        'coated_paper.cutting_350g.def.json',
        'corrugated_paper.cutting_1.6mm.def.json',
        'corrugated_paper.cutting_3mm.def.json',
        'crazy_horse_leather.cutting_2mm.def.json',
        'crazy_horse_leather.dot_filled_engraving.def.json',
        'crazy_horse_leather.line_filled_engraving.def.json',
        'crazy_horse_leather.vector_engraving.def.json',
        'mdf.cutting_2mm.def.json',
        'mdf.cutting_3mm.def.json',
        'mdf.dot_filled_engraving.def.json',
        'mdf.line_filled_engraving.def.json',
        'mdf.vector_engraving.def.json',
        'pinewood.cutting_4mm.def.json',
        'pinewood.cutting_8mm.def.json',
        'pinewood.dot_filled_engraving.def.json',
        'pinewood.line_filled_engraving.def.json',
        'vegetable_tanned_leather.cutting_1.5mm.def.json',
        'vegetable_tanned_leather.cutting_2mm.def.json',
        'vegetable_tanned_leather.dot_filled_engraving.def.json',
        'vegetable_tanned_leather.line_filled_engraving.def.json'
    ]
};
console.log('DEFAULT_PREDEFINED', DEFAULT_PREDEFINED);
const DEFAULT_PREDEFINED_ID = {
    'printing': 'quality.fast_print.def.json',
    'cnc': 'tool.default_CVbit.def.json',
    'laser': 'present.default_CUT.def.json',
    '10w-laser': 'basswood.cutting_1.5mm.def.json'
};
export class DefinitionLoader {
    definitionId = '';

    name = '';
    // default name key
    // i18nName = undefined;

    category = '';
    // default category key
    // i18nCategory = undefined;

    inherits = '';

    settings = {};

    ownKeys = new Set();

    metadata = {};

    isRecommended = false;

    loadDefinition(headType, definitionId, configPath) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        const suffix = ConfigV1Suffix;
        const filePath = configPath ? path.join(`${DataStorage.configDir}/${headType}/${configPath}`,
            `${definitionId}${suffix}`)
            : path.join(`${DataStorage.configDir}/${headType}`, `${definitionId}${suffix}`);

        // in case of JSON parse error, set default json inherits from snapmaker2.def.json
        let json = {
            'name': 'Snapmaker Default',
            'version': pkg.version,
            'inherits': 'snapmaker2'
        };
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            json = JSON.parse(data);
            this.loadJSON(headType, definitionId, json);
        } catch (e) {
            log.error(`JSON Syntax error of: ${definitionId}`);
        }
    }

    loadDefaultDefinition(headType, definitionId, configPath) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        const suffix = ConfigV1Suffix;
        const filePath = configPath ? path.join(`${DataStorage.defaultConfigDir}/${headType}/${configPath}`,
            `${definitionId}${suffix}`)
            : path.join(`${DataStorage.defaultConfigDir}/${headType}`, `${definitionId}${suffix}`);

        // in case of JSON parse error, set default json inherits from snapmaker2.def.json
        let json = {
            'name': 'Snapmaker Default',
            'version': pkg.version,
            'inherits': 'snapmaker2'
        };
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            json = JSON.parse(data);
            this.loadJSON(headType, definitionId, json);
        } catch (e) {
            log.error(`Default JSON Syntax error of: ${definitionId}`);
        }
    }

    loadJSON(headType, definitionId, json) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        if (json.inherits) {
            this.loadDefinition(headType, json.inherits);
            this.inherits = json.inherits;
        }

        // metadata
        if (json.metadata) {
            this.metadata = json.metadata;
        }

        if (json.name) {
            this.name = json.name;
        }
        if (json.i18nName) {
            this.i18nName = json.i18nName;
        }
        if (json.category) {
            this.category = json.category;
        }
        if (json.i18nCategory) {
            this.i18nCategory = json.i18nCategory;
        }
        if (!isNil(json.isRecommended)) {
            this.isRecommended = json.isRecommended;
        }

        // settings
        if (json.settings) {
            this.loadJSONSettings(definitionId, json.settings);
        }

        if (json.overrides) {
            this.loadJSONSettings(definitionId, json.overrides);
        }
    }

    loadJSONSettings(definitionId, json) {
        for (const key of Object.keys(json)) {
            const setting = json[key];

            if (setting.type !== 'category') {
                this.settings[key] = this.settings[key] || {};
                this.settings[key].from = definitionId;
                this.settings[key].isLeave = (setting.children === undefined);

                if (definitionId === this.definitionId && !this.ownKeys.has(key)) {
                    this.ownKeys.add(key);
                }

                for (const field of SETTING_FIELDS) {
                    if (setting[field] !== undefined) {
                        this.settings[key][field] = setting[field];
                    }
                }
            }
            if (setting.children) {
                this.loadJSONSettings(definitionId, setting.children);
            }
        }
    }

    toJSON() {
        const overrides = {};

        for (const key of this.ownKeys) {
            overrides[key] = {
                default_value: this.settings[key].default_value
            };
        }

        return {
            version: pkg.version,
            name: this.name,
            category: this.category,
            i18nName: this.i18nName,
            i18nCategory: this.i18nCategory,
            isRecommended: this.isRecommended,
            inherits: this.inherits,
            metadata: this.metadata,
            overrides
        };
    }

    toObject() {
        return {
            definitionId: this.definitionId,
            name: this.name,
            isRecommended: this.isRecommended,
            category: this.category,
            i18nName: this.i18nName,
            i18nCategory: this.i18nCategory,
            inherits: this.inherits,
            settings: this.settings,
            metadata: this.metadata,
            ownKeys: Array.from(this.ownKeys)
        };
    }

    fromObject(object) {
        this.definitionId = object.definitionId;
        this.name = object.name;
        this.category = object.category;
        this.i18nCategory = object.i18nCategory;
        this.inherits = object.inherits;
        this.ownKeys = new Set(object.ownKeys);
        this.settings = object.settings;
        this.metadata = object.metadata;
    }

    updateName(name) {
        this.name = name;
    }

    updateCategory(category) {
        this.category = category;
    }

    updateI18nName(i18nName) {
        this.i18nName = i18nName;
    }

    updateI18nCategory(i18nCategory) {
        this.i18nCategory = i18nCategory;
    }

    updateSettings(settings) {
        for (const key of Object.keys(settings)) {
            this.ownKeys.add(key);
        }
        this.settings = {
            ...this.settings,
            ...settings
        };
    }
}

function writeDefinition(headType, filename, series, definitionLoader) {
    const filePath = path.join(DataStorage.configDir, headType, series, filename);
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            log.error(`Failed to write definition: err=${JSON.stringify(err)}`);
        }
    });
}

export function loadDefinitionLoaderByFilename(headType, filename, configPath, isDefault = false) {
    let definitionId = '';
    if (ConfigV1Regex.test(filename)) {
        definitionId = filename.substr(0, filename.length - 9);
    }
    const definitionLoader = new DefinitionLoader();
    if (isDefault) {
        definitionLoader.loadDefaultDefinition(headType, definitionId, configPath);
    } else {
        definitionLoader.loadDefinition(headType, definitionId, configPath);
    }

    return definitionLoader;
}

export function loadDefinitionsByRegex(headType, configPath, regex, defaultId) {
    const defaultDefinitionLoader = loadDefinitionLoaderByFilename(headType, defaultId, configPath);
    const configDir = `${DataStorage.configDir}/${headType}`;
    let defaultFilenames = [];
    try {
        defaultFilenames = fs.readdirSync(`${configDir}/${configPath}`);
    } catch (e) {
        log.error(e);
    }
    const definitions = [];

    for (const filename of defaultFilenames) {
        if (regex.test(filename)) {
            const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath);
            if (!definitionLoader.isRecommended && defaultDefinitionLoader) {
                const ownKeys = Array.from(defaultDefinitionLoader.ownKeys).filter(e => !definitionLoader.ownKeys.has(e));
                if (ownKeys && ownKeys.length > 0) {
                    for (const ownKey of ownKeys) {
                        definitionLoader.ownKeys.add(ownKey);
                    }
                    writeDefinition(headType, filename, configPath, definitionLoader);
                }
            }
            definitions.push(definitionLoader.toObject());
        }
    }

    return definitions;
}


export function loadDefinitionsByPrefixName(headType, prefix = 'material', configPath) {
    let defaultId;
    /* eslint-disable-next-line */
    const regex = new RegExp(`^${prefix}\.([A-Za-z0-9_]+).([A-Za-z0-9_]+?)\.def\.json$`);
    if (prefix === 'material') {
        defaultId = 'material.pla.def.json';
    } else if (prefix === 'quality') {
        defaultId = 'quality.fast_print.def.json';
    }
    return loadDefinitionsByRegex(headType, configPath, regex, defaultId);
}

export function loadAllSeriesDefinitions(isDefault = false, headType, series = 'A150') {
    // TODO: series name?
    const _headType = (headType === 'laser' && includes(series, '10w')) ? '10w-laser' : headType;
    const predefined = DEFAULT_PREDEFINED_ID[_headType];
    const definitions = [];

    const configDir = isDefault ? `${DataStorage.defaultConfigDir}/${headType}`
        : `${DataStorage.configDir}/${headType}`;
    let defaultFilenames = [];
    try {
        defaultFilenames = fs.readdirSync(`${configDir}/${series}`);
    } catch (e) {
        log.error(e);
    }

    if (isDefault) {
        for (const filename of defaultFilenames) {
            const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, series, isDefault);
            definitions.push(definitionLoader.toObject());
        }
    } else {
        const defaultDefinitionLoader = loadDefinitionLoaderByFilename(headType, predefined, series);
        for (const filename of defaultFilenames) {
            if (ConfigV1Regex.test(filename)) {
                try {
                    const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, series, isDefault);
                    if (!definitionLoader.isRecommended && defaultDefinitionLoader) {
                        const ownKeys = Array.from(defaultDefinitionLoader.ownKeys).filter(e => !definitionLoader.ownKeys.has(e));
                        if (ownKeys && ownKeys.length > 0) {
                            for (const ownKey of ownKeys) {
                                definitionLoader.ownKeys.add(ownKey);
                            }
                            writeDefinition(headType, filename, series, definitionLoader);
                        }
                    }
                    definitions.push(definitionLoader.toObject());
                } catch (e) {
                    log.error(e);
                }
            }
        }
    }
    return definitions;
}
