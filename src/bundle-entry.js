// Bundle entry — imports every Univer package the SE OFFICE app needs +
// every preset's locale + every preset's CSS, then exposes the expected
// UMD-style globals on window. esbuild rolls all of this into a single
// dist/univer.js + dist/univer.css so the browser only fetches + parses
// two files instead of ~30 (which is where the warm-cache 14.7s mount
// time was dominated — see PERF profiling done on 2026-05-19).
//
// Globals named here must match exactly what index.html's loader code
// checks for (typeof UniverPresetSheetsFilter !== 'undefined', etc.) so
// the validation paths stay intact.

import * as UniverCore from '@univerjs/core';
import * as UniverPresets from '@univerjs/presets';

import * as UniverPresetSheetsCore from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import '@univerjs/preset-sheets-core/lib/index.css';

import * as UniverPresetSheetsFilter from '@univerjs/preset-sheets-filter';
import UniverPresetSheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import '@univerjs/preset-sheets-filter/lib/index.css';

import * as UniverPresetSheetsSort from '@univerjs/preset-sheets-sort';
import UniverPresetSheetsSortEnUS from '@univerjs/preset-sheets-sort/locales/en-US';
import '@univerjs/preset-sheets-sort/lib/index.css';

import * as UniverPresetSheetsFindReplace from '@univerjs/preset-sheets-find-replace';
import UniverPresetSheetsFindReplaceEnUS from '@univerjs/preset-sheets-find-replace/locales/en-US';
import '@univerjs/preset-sheets-find-replace/lib/index.css';

import * as UniverPresetSheetsConditionalFormatting from '@univerjs/preset-sheets-conditional-formatting';
import UniverPresetSheetsConditionalFormattingEnUS from '@univerjs/preset-sheets-conditional-formatting/locales/en-US';
import '@univerjs/preset-sheets-conditional-formatting/lib/index.css';

import * as UniverPresetSheetsDataValidation from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import '@univerjs/preset-sheets-data-validation/lib/index.css';

import * as UniverPresetSheetsDrawing from '@univerjs/preset-sheets-drawing';
import UniverPresetSheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';
import '@univerjs/preset-sheets-drawing/lib/index.css';

import * as UniverPresetSheetsHyperLink from '@univerjs/preset-sheets-hyper-link';
import UniverPresetSheetsHyperLinkEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US';
import '@univerjs/preset-sheets-hyper-link/lib/index.css';

import * as UniverPresetSheetsNote from '@univerjs/preset-sheets-note';
import UniverPresetSheetsNoteEnUS from '@univerjs/preset-sheets-note/locales/en-US';
import '@univerjs/preset-sheets-note/lib/index.css';

import * as UniverPresetSheetsTable from '@univerjs/preset-sheets-table';
import UniverPresetSheetsTableEnUS from '@univerjs/preset-sheets-table/locales/en-US';
import '@univerjs/preset-sheets-table/lib/index.css';

import * as UniverPresetDocsCore from '@univerjs/preset-docs-core';
import UniverPresetDocsCoreEnUS from '@univerjs/preset-docs-core/locales/en-US';
import '@univerjs/preset-docs-core/lib/index.css';

import * as UniverSheetsCrosshairHighlight from '@univerjs/sheets-crosshair-highlight';
import '@univerjs/sheets-crosshair-highlight/lib/index.css';

// Univer peer deps — bundle these instead of separate <script> tags
// for react / react-dom / rxjs from unpkg.
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as rxjs from 'rxjs';

// Expose React / ReactDOM / rxjs on window. Univer's UMD bundle assumes
// React 18 globals exist (it was built for <script src=react.production.min.js>
// + <script src=react-dom.production.min.js> usage). We merge the client
// API into ReactDOM so the global matches the legacy shape.
window.React = React;
window.ReactDOM = Object.assign({}, ReactDOM, ReactDOMClient);
window.rxjs = rxjs;

// Univer core + preset wrapper
window.UniverCore = UniverCore;
window.UniverPresets = UniverPresets;

// Sheet presets — each exposes a UniverSheetsXxxPreset constructor
// inside the module namespace, plus a default-exported locales object.
window.UniverPresetSheetsCore = UniverPresetSheetsCore;
window.UniverPresetSheetsCoreEnUS = UniverPresetSheetsCoreEnUS;

window.UniverPresetSheetsFilter = UniverPresetSheetsFilter;
window.UniverPresetSheetsFilterEnUS = UniverPresetSheetsFilterEnUS;

window.UniverPresetSheetsSort = UniverPresetSheetsSort;
window.UniverPresetSheetsSortEnUS = UniverPresetSheetsSortEnUS;

window.UniverPresetSheetsFindReplace = UniverPresetSheetsFindReplace;
window.UniverPresetSheetsFindReplaceEnUS = UniverPresetSheetsFindReplaceEnUS;

window.UniverPresetSheetsConditionalFormatting = UniverPresetSheetsConditionalFormatting;
window.UniverPresetSheetsConditionalFormattingEnUS = UniverPresetSheetsConditionalFormattingEnUS;

window.UniverPresetSheetsDataValidation = UniverPresetSheetsDataValidation;
window.UniverPresetSheetsDataValidationEnUS = UniverPresetSheetsDataValidationEnUS;

window.UniverPresetSheetsDrawing = UniverPresetSheetsDrawing;
window.UniverPresetSheetsDrawingEnUS = UniverPresetSheetsDrawingEnUS;

window.UniverPresetSheetsHyperLink = UniverPresetSheetsHyperLink;
window.UniverPresetSheetsHyperLinkEnUS = UniverPresetSheetsHyperLinkEnUS;

window.UniverPresetSheetsNote = UniverPresetSheetsNote;
window.UniverPresetSheetsNoteEnUS = UniverPresetSheetsNoteEnUS;

window.UniverPresetSheetsTable = UniverPresetSheetsTable;
window.UniverPresetSheetsTableEnUS = UniverPresetSheetsTableEnUS;

// Docs preset
window.UniverPresetDocsCore = UniverPresetDocsCore;
window.UniverPresetDocsCoreEnUS = UniverPresetDocsCoreEnUS;

// Crosshair highlight (plain plugin, no preset wrapper)
window.UniverSheetsCrosshairHighlight = UniverSheetsCrosshairHighlight;
