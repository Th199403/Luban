import * as THREE from 'three';
import { DEFAULT_LUBAN_HOST } from '../../constants';

export const lineMaterialUniforms = {
    u_visible_layer_range_start: { value: 0.0 },
    u_visible_layer_range_end: { value: 0.0 },

    u_middle_layer_set_gray: { value: 0 },

    u_color_type: { value: 0 },
    u_l_wall_inner_visible: { value: 1 },
    u_l_wall_outer_visible: { value: 1 },
    u_l_skin_visible: { value: 1 },
    u_l_skirt_visible: { value: 1 },
    u_l_support_visible: { value: 1 },
    u_l_fill_visible: { value: 1 },
    u_l_travel_visible: { value: 0 },
    u_l_unknown_visible: { value: 1 },
    u_r_wall_inner_visible: { value: 1 },
    u_r_wall_outer_visible: { value: 1 },
    u_r_skin_visible: { value: 1 },
    u_r_skirt_visible: { value: 1 },
    u_r_support_visible: { value: 1 },
    u_r_fill_visible: { value: 1 },
    u_r_travel_visible: { value: 0 },
    u_r_unknown_visible: { value: 1 },
    texture_test: {
        type: 't',
        value: new THREE.TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/wood.png`)
    }
};


export const lineMaterialFragmentShader = /* glsl */`
#define LINE

uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

uniform float u_visible_layer_range_start;
uniform float u_visible_layer_range_end;

uniform int u_middle_layer_set_gray;

uniform int u_color_type;
uniform int u_l_wall_inner_visible;
uniform int u_l_wall_outer_visible;
uniform int u_l_skin_visible;
uniform int u_l_skirt_visible;
uniform int u_l_support_visible;
uniform int u_l_fill_visible;
uniform int u_l_travel_visible;
uniform int u_l_unknown_visible;
uniform int u_r_wall_inner_visible;
uniform int u_r_wall_outer_visible;
uniform int u_r_skin_visible;
uniform int u_r_skirt_visible;
uniform int u_r_support_visible;
uniform int u_r_fill_visible;
uniform int u_r_travel_visible;
uniform int u_r_unknown_visible;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

varying float alpha;
varying vec3 v_color0;
varying vec3 v_color1;
varying float v_layer_index;
varying float v_type_code;
varying float v_tool_code;

precision highp float;
uniform sampler2D texture_test; // identify the texture as a uniform argument
varying vec2 vUv; // identify the uv values as a varying attribute

void main() {

	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;

    if(v_layer_index > u_visible_layer_range_end){
        return;
    }
    if(v_layer_index < u_visible_layer_range_start){
        return;
    }
    if(u_l_wall_inner_visible == 0 && 0.5 < v_type_code && v_type_code < 1.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_l_wall_outer_visible == 0 && 1.5 < v_type_code && v_type_code < 2.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_l_skin_visible == 0 && 2.5 < v_type_code && v_type_code < 3.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_l_skirt_visible == 0 && 3.5 < v_type_code && v_type_code < 4.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_l_support_visible == 0 && 4.5 < v_type_code && v_type_code < 5.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_l_fill_visible == 0 && 5.5 < v_type_code && v_type_code < 6.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_l_travel_visible == 0 && 6.5 < v_type_code && v_type_code < 7.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_l_unknown_visible == 0 && 7.5 < v_type_code && v_type_code < 8.5 && v_tool_code < 0.5){
        discard;
    }

    if(u_r_wall_inner_visible == 0 && 0.5 < v_type_code && v_type_code < 1.5 && v_tool_code > 0.5){
        discard;
    }

    if(u_r_wall_outer_visible == 0 && 1.5 < v_type_code && v_type_code < 2.5 && v_tool_code > 0.5){
        discard;
    }

    if(u_r_skin_visible == 0 && 2.5 < v_type_code && v_type_code < 3.5 && v_tool_code > 0.5){
        discard;
    }

    if(u_r_skirt_visible == 0 && 3.5 < v_type_code && v_type_code < 4.5 && v_tool_code > 0.5){
        discard;
    }

    if(u_r_support_visible == 0 && 4.5 < v_type_code && v_type_code < 5.5 && v_tool_code > 0.5){
        discard;
    }

    if(u_r_fill_visible == 0 && 5.5 < v_type_code && v_type_code < 6.5 && v_tool_code > 0.5){
        discard;
    }

    if(u_r_travel_visible == 0 && 6.5 < v_type_code && v_type_code < 7.5 && v_tool_code > 0.5){
        discard;
    }

    if(u_r_unknown_visible == 0 && 7.5 < v_type_code && v_type_code < 8.5 && v_tool_code > 0.5){
        discard;
    }
    if(u_middle_layer_set_gray == 1){
        if(v_layer_index == u_visible_layer_range_end){
           gl_FragColor = vec4(v_color0.xyz, diffuseColor.a);
        } else {
           gl_FragColor = vec4(0.6, 0.6, 0.6, diffuseColor.a * 0.75);
        }
        return;
    }
    // gl_FragColor = texture2D(texture_test, vUv);
    gl_FragColor = vec4(v_color0.xyz, diffuseColor.a);
    if(u_color_type == 1 && !(6.5 < v_type_code && v_type_code < 7.5)){
        gl_FragColor = vec4(v_color1.xyz, diffuseColor.a);
    }

	#include <envmap_fragment>

	// gl_FragColor = vec4( 1.0, 0, 0, diffuseColor.a );

	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}
`;

export const lineMaterialVertexShader = /* glsl */`
#define PHONG

varying vec3 vViewPosition;
varying vec2 vUv;

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif

#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

uniform float u_visible_layer_range_start;
uniform float u_visible_layer_range_end;

uniform int u_middle_layer_set_gray;

uniform int u_color_type;
uniform int u_l_wall_inner_visible;
uniform int u_l_wall_outer_visible;
uniform int u_l_skin_visible;
uniform int u_l_skirt_visible;
uniform int u_l_support_visible;
uniform int u_l_fill_visible;
uniform int u_l_travel_visible;
uniform int u_l_unknown_visible;
uniform int u_r_wall_inner_visible;
uniform int u_r_wall_outer_visible;
uniform int u_r_skin_visible;
uniform int u_r_skirt_visible;
uniform int u_r_support_visible;
uniform int u_r_fill_visible;
uniform int u_r_travel_visible;
uniform int u_r_unknown_visible;

varying float alpha;
varying vec3 v_color0;
varying vec3 v_color1;
varying float v_layer_index;
varying float v_type_code;
varying float v_tool_code;

attribute float a_layer_index;
attribute float a_type_code;
attribute float a_tool_code;
attribute vec3 a_color;
attribute vec3 a_color1;


void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
    v_layer_index = a_layer_index;
    v_type_code = a_type_code;
    v_tool_code = a_tool_code;
    v_color0 = a_color;
    v_color1 = a_color1;
#ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED

	vNormal = normalize( transformedNormal );

#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
    vUv = uv;
	vViewPosition = - mvPosition.xyz;
    // gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`;
