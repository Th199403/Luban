import i18next from 'i18next';
// import { Steps } from 'intro.js-react';
import 'intro.js/introjs.css';
import isElectron from 'is-electron';
import { find, includes } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, withRouter } from 'react-router-dom';

import { LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_MATERIAL } from '../../constants';
import { HEAD_PRINTING, isDualExtruder, MACHINE_SERIES } from '../../constants/machines';
import { actions as machineActions } from '../../flux/machine';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import { machineStore } from '../../store/local-storage';
import '../../styles/introCustom.styl';
import Dropzone from '../components/Dropzone';
import Steps from '../components/Steps';
import MainToolBar from '../layouts/MainToolBar';
import ProjectLayout from '../layouts/ProjectLayout';
import { logPageView, renderPopup, useUnsavedTitle } from '../utils';
// import PrintingOutput from '../widgets/PrintingOutput';
import PrintingManager from '../views/PrintingManager';
import PrintingConfigurationsWidget, { PresetInitialization } from '../widgets/PrintingConfigurationWidget';
import PrintingOutputWidget from '../widgets/PrintingOutput';
import Thumbnail from '../widgets/PrintingOutput/Thumbnail';
import PrintingVisualizer from '../widgets/PrintingVisualizer';

import PrintingObjectListStyles from '../views/PrintingObjectList/styles.styl';

import HomePage from './HomePage';
import { CaseConfigGimbal, CaseConfigPenHolder } from './HomePage/CaseConfig';
import {
    printIntroStepEight,
    printIntroStepFive,
    printIntroStepFour,
    printIntroStepNine,
    printIntroStepOne,
    printIntroStepSeven,
    printIntroStepThree,
    getStepIntroFromText,
} from './introContent';
import MachineMaterialSettings from './MachineMaterialSettings';
import { PageMode } from './PageMode';
import Workspace from './Workspace';

export const openFolder = () => {
    if (isElectron()) {
        const ipc = window.require('electron').ipcRenderer;
        ipc.send('open-recover-folder');
    }
};

const pageHeadType = HEAD_PRINTING;

function useRenderMainToolBar(pageMode, setPageMode, profileInitialized = false) {
    const unSaved = useSelector(state => state?.project[pageHeadType]?.unSaved, shallowEqual);
    const { inProgress, simplifyType, simplifyPercent } = useSelector(state => state?.printing, shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const canRedo = useSelector(state => state?.printing?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state?.printing?.history?.canUndo, shallowEqual);
    const canGroup = useSelector(state => state?.printing?.modelGroup?.canGroup());
    const canMerge = useSelector(state => state?.printing?.modelGroup?.canMerge());
    const canUngroup = useSelector(state => state?.printing?.modelGroup?.canUngroup());
    // const toolHeadObj = useSelector(state => state?.machine?.toolHead);
    const canSimplify = useSelector(state => state?.printing?.modelGroup?.canSimplify());
    const canRepair = useSelector(state => state?.printing?.modelGroup?.canRepair());
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showMachineMaterialSettings, setShowMachineMaterialSettings] = useState(false);
    const { series, toolHead } = useSelector(state => state?.machine);
    const seriesRef = useRef(series);
    const toolHeadRef = useRef(toolHead);
    const [currentSeries, setCurrentSeries] = useState(series);
    const [currentToolhead, setCurrentToolHead] = useState(toolHead.printingToolhead);

    const dispatch = useDispatch();

    function renderHomepage() {
        const onClose = () => {
            setShowHomePage(false);
            logPageView({
                pathname: '/printing'
            });
        };
        return showHomePage && renderPopup({
            onClose,
            component: HomePage,
            key: 'homepage'
        });
    }

    function renderWorkspace() {
        const onClose = () => {
            setShowWorkspace(false);
            logPageView({
                pathname: '/printing'
            });
        };
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace,
            key: 'workspace'
        });
    }

    function renderMachineMaterialSettings() {
        const onClose = async () => {
            setShowMachineMaterialSettings(false);
            if (currentSeries !== seriesRef.current || currentToolhead !== toolHeadRef.current.printingToolhead) {
                dispatch(machineActions.updateMachineSeries(currentSeries));
                dispatch(machineActions.setZAxisModuleState(currentSeries === MACHINE_SERIES.ORIGINAL_LZ.value));
                dispatch(machineActions.updateMachineToolHead({
                    ...toolHead,
                    printingToolhead: currentToolhead
                }, currentSeries));
                await dispatch(projectActions.clearSavedEnvironment(HEAD_PRINTING));
                window.location.href = '/';
            }
        };
        const onCallBack = (_series, _toolHead) => {
            setCurrentSeries(_series);
            setCurrentToolHead(_toolHead.printingToolhead);
        };
        return showMachineMaterialSettings && renderPopup({
            onClose,
            component: MachineMaterialSettings,
            key: 'machineMaterialSettings',
            onCallBack: onCallBack
        });
    }

    /**
     * Render main tool bar on the top.
     *
     * @param activeMachine
     * @param machineInfo
     * @param materialInfo
     * @param isConnected
     * @returns {*}
     */
    function renderMainToolBar(activeMachine, machineInfo, materialInfo, isConnected) {
        //
        //
        //
        const leftItems = [
            {
                title: i18n._('key-Printing/Page-Home'),
                disabled: inProgress,
                type: 'button',
                name: 'MainToolbarHome',
                action: () => {
                    setShowHomePage(true);
                }
            },
            {
                title: i18n._('key-Printing/Page-Workspace'),
                type: 'button',
                name: 'MainToolbarWorkspace',
                action: () => {
                    setShowWorkspace(true);
                }
            },
            {
                type: 'separator',
                name: 'separator'
            },
            {
                title: i18n._('key-Printing/Page-Save'),
                disabled: !unSaved || !enableShortcut,
                type: 'button',
                name: 'MainToolbarSave',
                iconClassName: 'printing-save-icon',
                action: () => {
                    dispatch(projectActions.save(HEAD_PRINTING));
                }
            },
            {
                title: i18n._('key-Printing/Page-Undo'),
                disabled: !canUndo || !enableShortcut,
                type: 'button',
                name: 'MainToolbarUndo',
                action: () => {
                    dispatch(printingActions.undo());
                }
            },
            {
                title: i18n._('key-Printing/Page-Redo'),
                disabled: !canRedo || !enableShortcut,
                type: 'button',
                name: 'MainToolbarRedo',
                action: () => {
                    dispatch(printingActions.redo());
                }
            },
            {
                type: 'separator',
                name: 'separator'
            },
            {
                className: 'print-edit-model-intro',
                children: [
                    {
                        title: i18n._('key-3DP/MainToolBar-Align'),
                        disabled: !canMerge || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarMerge',
                        action: () => {
                            dispatch(printingActions.groupAndAlign());
                        }
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Group'),
                        disabled: !canGroup || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarGroup',
                        action: () => {
                            dispatch(printingActions.group());
                        }
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Ungroup'),
                        disabled: !canUngroup || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarUngroup',
                        action: () => {
                            dispatch(printingActions.ungroup());
                        }
                    },
                    {
                        type: 'separator',
                        name: 'separator'
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Model Simplify'),
                        disabled: !canSimplify || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarSimplifiedModel',
                        action: async () => {
                            if (pageMode === PageMode.Simplify) {
                                // Click again will not exit simplify page mode
                                // setPageMode(PageMode.Default);
                            } else {
                                setPageMode(PageMode.Simplify);
                                const repaired = await dispatch(printingActions.isModelsRepaired());
                                if (repaired) {
                                    dispatch(printingActions.modelSimplify(simplifyType, simplifyPercent, true));
                                } else {
                                    // TODO: popup a notification? or just disable the button
                                }
                            }
                        }
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Model repair'),
                        disabled: !canRepair || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarFixModel',
                        action: () => {
                            dispatch(printingActions.repairSelectedModels());
                        }
                    },
                    {
                        type: 'separator',
                        name: 'separator'
                    },
                ]
            },
            {
                title: i18n._('Mode'),
                disabled: !profileInitialized,
                type: 'button',
                name: 'MainToolbarMode',
                action: () => {
                    if (pageMode === PageMode.ChangePrintMode) {
                        setPageMode(PageMode.Default);
                    } else if (pageMode === PageMode.Default) {
                        setPageMode(PageMode.ChangePrintMode);
                    }
                },
            },
            {
                title: i18n._('key-Printing/MainToolBar-Materials'),
                disabled: !profileInitialized,
                type: 'button',
                name: 'MainToolbarMaterialSetting',
                action: () => {
                    dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
                    dispatch(printingActions.updateShowPrintingManager(true));
                },
            },
            {
                title: i18n._('key-Printing/MainToolBar-Print Settings'),
                disabled: !profileInitialized,
                type: 'button',
                name: 'MainToolbarPrintingSetting',
                action: () => {
                    dispatch(printingActions.updateState({
                        showPrintParameterModifierDialog: LEFT_EXTRUDER,
                    }));
                },
            },
        ];

        return (
            <MainToolBar
                leftItems={leftItems}
                profileInitialized={profileInitialized}
                lang={i18next.language}
                headType={HEAD_PRINTING}
                hasMachineSettings
                activeMachine={activeMachine}
                materialInfo={materialInfo}
                isConnected={isConnected}
                setShowMachineMaterialSettings={(show) => {
                    seriesRef.current = series;
                    toolHeadRef.current = toolHead;
                    setShowMachineMaterialSettings(show);
                }}
            />
        );
    }

    return [renderHomepage, renderMainToolBar, renderWorkspace, renderMachineMaterialSettings];
}

function getStarterProject(series) {
    const pathConfigForSM2 = {
        path: './UserCase/printing/a150_single/3dp_a150_single.snap3dp',
        name: '3dp_a150_single.snap3dp'
    };
    const pathConfigForOriginal = {
        path: './UserCase/printing/original_single/3dp_original_single.snap3dp',
        name: '3dp_original_single.snap3dp'
    };

    // TODO: Refactor to not hard coding
    let pathConfig;
    if ([MACHINE_SERIES.ORIGINAL.value, MACHINE_SERIES.ORIGINAL_LZ.value].includes(series)) {
        pathConfig = pathConfigForOriginal;
    } else if (series === MACHINE_SERIES.A400.value) {
        pathConfig = CaseConfigPenHolder.pathConfig;
    } else if (series === MACHINE_SERIES.J1.value) {
        pathConfig = CaseConfigGimbal.pathConfig;
    } else {
        pathConfig = pathConfigForSM2;
    }
    return pathConfig;
}

function Printing({ location }) {
    const series = useSelector(state => state?.machine?.series);
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight);
    const leftMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
    const rightMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
    const machineState = useSelector(state => state?.machine);
    const activeMachine = useSelector(state => state.machine.activeMachine);

    const { isConnected, toolHead: { printingToolhead } } = machineState;
    const isOriginal = includes(series, 'Original');

    // const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const [initIndex, setInitIndex] = useState(0);
    const [machineInfo, setMachineInfo] = useState({});
    const [materialInfo, setMaterialInfo] = useState({});
    // for simplify model, if true, visaulizerLeftbar and main tool bar can't be use
    const [pageMode, setPageMode] = useState(PageMode.Default);

    const dispatch = useDispatch();
    const history = useHistory();
    const [
        renderHomepage, renderMainToolBar, renderWorkspace, renderMachineMaterialSettings
    ] = useRenderMainToolBar(pageMode, setPageMode, !!materialDefinitions.length);
    const modelGroup = useSelector(state => state.printing.modelGroup);
    const thumbnail = useRef();
    const stepRef = useRef();
    useUnsavedTitle(pageHeadType);

    useEffect(() => {
        (async () => {
            if (!location?.state?.initialized) {
                await dispatch(printingActions.init());
            }
        })();

        // Make sure execute 'initSocketEvent' after 'printingActions.init' on openning project
        setTimeout(() => {
            dispatch(printingActions.initSocketEvent());
        }, 50);
        dispatch(printingActions.checkNewUser());

        logPageView({
            pathname: '/printing'
        });
    }, []);

    useEffect(() => {
        const newMachineInfo = {
            series: series,
            toolHead: printingToolhead
        };
        const material = {
            leftExtruder: {
                name: leftMaterial?.name,
                color: leftMaterial?.settings?.color?.default_value
            }
        };

        if (isDualExtruder(printingToolhead)) {
            material.rightExtruder = {
                name: rightMaterial?.name,
                color: rightMaterial?.settings?.color?.default_value
            };
        }

        setMachineInfo(newMachineInfo);
        setMaterialInfo(material);
        renderMainToolBar(activeMachine, newMachineInfo, material, isConnected);
    }, [activeMachine, series, leftMaterial, rightMaterial, printingToolhead]);

    // Determine page mode
    useEffect(() => {
        // Switch to ChangePrintMode page mode when first enter the page, if the machine has
        // more than 1 print mode.
        if (activeMachine) {
            const printModes = activeMachine.metadata?.printModes;
            if (printModes?.length > 1) {
                setPageMode(PageMode.ChangePrintMode);
            }
        }
    }, [activeMachine]);

    useEffect(() => {
        renderMainToolBar(activeMachine, machineInfo, materialInfo, isConnected);
    }, [isConnected]);

    useEffect(() => {
        if (location?.state?.shouldShowGuideTours) {
            setEnabledIntro(true);
        } else if (!location?.state?.shouldShowGuideTours && typeof (location?.state?.shouldShowGuideTours) === 'boolean') {
            setEnabledIntro(false);
        } else {
            setEnabledIntro(null);
        }
    }, [location?.state?.shouldShowGuideTours]);

    useEffect(() => {
        if (typeof (enabledIntro) === 'boolean' && !enabledIntro) {
            machineStore.set('guideTours.guideTours3dp', true);
        }
    }, [enabledIntro]);

    async function onDropAccepted(files) {
        // const allFiles = files.map(d => d.name).join();
        // try {
        await dispatch(printingActions.uploadModel(files));
        // } catch (e) {
        //     modal({
        //         title: i18n._('key-Printing/Page-Failed to open model.'),
        //         body: (
        //             <React.Fragment>
        //                 <p>{e.message || e.body.msg}</p>
        //                 <p>{i18n._('key-Printing/ContextMenu-Model source name')}: {allFiles}</p>
        //             </React.Fragment>
        //         )
        //     });
        // }
    }

    function onDropRejected() {
        const title = i18n._('key-Printing/Page-Warning');
        const body = i18n._('key-Printing/Page-Only STL/OBJ files are supported.');
        modal({
            title: title,
            cancelTitle: i18n._('key-Workspace/WorkflowControl-Close'),
            body: body
        });
    }

    function renderModalView() {
        return (<PrintingManager />);
    }

    const renderRightView = () => {
        return (
            <div className="sm-flex sm-flex-direction-c height-percent-100">
                <PrintingConfigurationsWidget
                    className="margin-bottom-8 sm-flex-width"
                />
                <PrintingOutputWidget />
            </div>
        );
    };
    // const onClickToUpload = () => {
    //     UniApi.Event.emit('appbar-menu:open-file-in-browser');
    // };
    const handleGuideStepChange = async (nextIndex) => {
        if (nextIndex === 1) {
            setInitIndex(1);

            const projectConfig = getStarterProject(series);

            dispatch(projectActions.openProject(projectConfig, history, true, true));
        }
    };

    const handleExit = () => {
        // machineStore.set('guideTours.guideTours3dp', true); // mock   ---> true
        setEnabledIntro(false);
    };

    return (
        <ProjectLayout
            renderMainToolBar={() => renderMainToolBar(activeMachine, machineInfo, materialInfo, isConnected)}
            renderRightView={renderRightView}
            renderModalView={renderModalView}
        >
            <Dropzone
                multiple
                disabled={false}
                accept=".stl, .obj, .3mf, .amf"
                dragEnterMsg={i18n._('key-Printing/Page-Drop an STL/OBJ file here.')}
                onDropAccepted={onDropAccepted}
                onDropRejected={onDropRejected}
            >
                <PrintingVisualizer
                    widgetId="printingVisualizer"
                    pageMode={pageMode}
                    setPageMode={setPageMode}
                />
                {renderHomepage()}
                {renderWorkspace()}
                {renderMachineMaterialSettings()}
                {enabledIntro && (
                    <Steps
                        enabled={enabledIntro}
                        initialStep={initIndex}
                        onChange={handleGuideStepChange}
                        ref={stepRef}
                        options={{
                            showBullets: false,
                            keyboardNavigation: false,
                            exitOnOverlayClick: false
                        }}
                        steps={[
                            {
                                element: '.print-tool-bar-open',
                                intro: printIntroStepOne(i18n._('key-Printing/Page-Import an object, or drag an object to Luban.')),
                                position: 'right',
                                title: `${i18n._('key-Printing/Page-Import Object')} (1/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-import-intro'
                            },
                            {
                                element: `.${PrintingObjectListStyles['object-list-view']}`,
                                intro: getStepIntroFromText(i18n._('key-Printing/Beginner Guide-Object List Introduction')),
                                position: 'right',
                                title: `${i18n._('key-Printing/ObjectList-Object List')} (2/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-placement-intro'
                            },
                            {
                                element: '.print-intro-three',
                                intro: getStepIntroFromText(i18n._('key-Printing/Page-Place or transform the object using icons, including Move, Scale, Rotate, Mirror, and Manual Support.')),
                                position: 'right',
                                title: `${i18n._('key-Printing/Page-Placement')} (3/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-placement-intro'
                            }, {
                                element: '.print-edit-model-intro',
                                intro: printIntroStepThree(
                                    i18n._('key-Printing/Page-Arrange and edit objects to achieve the intended 3D printing effect.')
                                ),
                                position: 'bottom',
                                title: `${i18n._('key-Printing/Page-Edit Objects')} (4/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-edit-model-intro'
                            }, {
                                element: '.print-machine-material-intro',
                                intro: printIntroStepFour(
                                    i18n._('key-Printing/Page-Select the machine model and the materials you use.')
                                ),
                                position: 'left',
                                title: `${i18n._('key-Printing/Page-Select Machine and Materials')} (5/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-machine-material-intro'
                            }, {
                                element: '.configuration-view',
                                intro: printIntroStepFive(
                                    i18n._('key-Printing/Page-Select a printing mode.'),
                                    i18n._('key-Printing/Page-Unfold Printing Settings to adjust printing parameters.')
                                ),
                                position: 'left',
                                title: `${i18n._('key-Printing/Page-Configure Parameters')} (6/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-configure-parameters-intro'
                            }, {
                                element: '.print-output-intro',
                                intro: printIntroStepSeven(
                                    i18n._('key-Printing/Page-Slice and preview the object.'),
                                    i18n._('key-Printing/Page-In Preview, you can see printing paths using features, including Line Type and Layer View.'),
                                    isOriginal
                                ),
                                position: 'top',
                                title: `${i18n._('key-Printing/Page-Generate G-code and Preview')} (7/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-preview-intro'
                            }, {
                                element: '.print-output-intro',
                                intro: printIntroStepEight(i18n._('key-Printing/Page-Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start printing.')),
                                position: 'top',
                                title: `${i18n._('key-Printing/Page-Export and Print')} (8/9)`,
                                disableInteraction: true,
                                highlightClass: 'printing-export-highlight-part',
                                tooltipClass: 'printing-export-intro'
                            }, {
                                element: '.printing-save-icon',
                                intro: printIntroStepNine(i18n._('key-Printing/Page-Save the project to a local device for reuse.')),
                                position: 'bottom',
                                title: `${i18n._('key-Printing/Page-Save Project')} (9/9)`,
                                disableInteraction: true,
                                tooltipClass: 'printing-save-intro'
                            }
                        ]}
                        onExit={handleExit}
                    />
                )}
            </Dropzone>
            <Thumbnail
                ref={thumbnail}
                modelGroup={modelGroup}
            />
            <PresetInitialization />
        </ProjectLayout>
    );
}

Printing.propTypes = {
    location: PropTypes.object
};
export default (withRouter(Printing));
