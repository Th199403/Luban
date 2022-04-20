import * as THREE from 'three';
import {
    // RawShaderMaterial,
    // ShaderMaterial,
    // TangentSpaceNormalMap,
    // Vector2,
    // MultiplyOperation,
    // mergeUniforms,
    UniformsUtils,
    ShaderLib,
    Color,
    NormalBlending,
} from 'three';
// import { Line2 } from 'three/examples/jsm/lines/Line2';
import { PRINT3D_UNIFORMS, PRINT3D_VERT_SHADER, PRINT3D_FRAG_SHADER } from '../ShaderMaterial/print3d-shader-meterial';
import { lineMaterialUniforms, lineMaterialFragmentShader, lineMaterialVertexShader } from '../ShaderMaterial/meshphong.glsl';
import { WORKSPACE_UNIFORMS, WORKSPACE_FRAG_SHADER, WORKSPACE_VERT_SHADER } from '../ShaderMaterial/workspace-shader-meterial';

const gcodeBufferGeometryToObj3d = (func, bufferGeometry, renderMethod) => {
    let obj3d = null;
    switch (func) {
        case '3DP':
            if (renderMethod === 'mesh') {
                const shader = new THREE.ShaderMaterial({
                    // uniforms: lineMaterialUniforms,
                    vertexShader: lineMaterialVertexShader,
                    fragmentShader: lineMaterialFragmentShader,
                    lights: true,
                    vertexColors: true,
                    blending: NormalBlending,
                });
                shader.setValues({
                    uniforms: UniformsUtils.merge([
                        { ...ShaderLib.phong.uniforms, ...lineMaterialUniforms },
                        // mergeUniforms([ShaderLib.phong.uniforms, lineMaterialUniforms]),
                        { diffuse: { value: new Color('#ffffff') } },
                        { time: { value: 0.0 } },
                    ]),
                });
                console.log('ShaderLib.phong.uniforms', ShaderLib.phong.uniforms, shader);
                obj3d = new THREE.Mesh(
                    bufferGeometry,
                    shader
                );
            } else {
                obj3d = new THREE.Line(
                    bufferGeometry,
                    new THREE.ShaderMaterial({
                        uniforms: PRINT3D_UNIFORMS,
                        vertexShader: PRINT3D_VERT_SHADER,
                        fragmentShader: PRINT3D_FRAG_SHADER,
                        side: THREE.DoubleSide,
                        transparent: true,
                        linewidth: 10,
                        wireframeLinewidth: 5
                    })
                );
            }

            break;
        case 'WORKSPACE':
            if (renderMethod === 'point') {
                obj3d = new THREE.Points(
                    bufferGeometry,
                    new THREE.ShaderMaterial({
                        uniforms: WORKSPACE_UNIFORMS,
                        vertexShader: WORKSPACE_VERT_SHADER,
                        fragmentShader: WORKSPACE_FRAG_SHADER,
                        side: THREE.DoubleSide,
                        transparent: true
                    })
                );
            } else {
                obj3d = new THREE.Line(
                    bufferGeometry,
                    new THREE.ShaderMaterial({
                        uniforms: WORKSPACE_UNIFORMS,
                        vertexShader: WORKSPACE_VERT_SHADER,
                        fragmentShader: WORKSPACE_FRAG_SHADER,
                        side: THREE.DoubleSide,
                        transparent: true
                    })
                );
            }
            break;
        default:
            break;
    }
    return obj3d;
};

export default gcodeBufferGeometryToObj3d;
