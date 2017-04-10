import { Texture } from '../../../textures/Texture';
import { Vector3 } from '../../../math/Vector3';
import { Quaternion } from '../../../math/Quaternion';

/**
 * @author mikael emtinger / http://gomo.se/
 * @author alteredq / http://alteredqualia.com/
 */

function SpritePlugin( renderer, sprites ) {

	var gl = renderer.context;
	var state = renderer.state;

  var vertexBuffer, elementBuffer;
	var defaultProgram;
  var programs = [];

  var texture;

  // decompose matrixWorld

	var spritePosition = new Vector3();
	var spriteRotation = new Quaternion();
	var spriteScale = new Vector3();

	var init = function () {

		var vertices = new Float32Array( [
			- 0.5, - 0.5, 0, 0,
			  0.5, - 0.5, 1, 0,
			  0.5,   0.5, 1, 1,
			- 0.5,   0.5, 0, 1
		] );

		var faces = new Uint16Array( [
			0, 1, 2,
			0, 2, 3
		] );

		vertexBuffer  = gl.createBuffer();
		elementBuffer = gl.createBuffer();

		gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW );

		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, elementBuffer );
		gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, faces, gl.STATIC_DRAW );

    defaultProgram = new WebGLSpriteProgram();
    programs.push( defaultProgram );

		var canvas = document.createElementNS( 'http://www.w3.org/1999/xhtml', 'canvas' );
		canvas.width = 8;
		canvas.height = 8;

		var context = canvas.getContext( '2d' );
		context.fillStyle = 'white';
		context.fillRect( 0, 0, 8, 8 );

		texture = new Texture( canvas );
		texture.needsUpdate = true;

	};

	this.render = function ( scene, camera ) {

    if ( sprites.length === 0 ) return;

    if ( defaultProgram === undefined ) {

      init();

    }


		// update positions and sort

    var i, numSprites = sprites.length, sprite;

		for ( i = 0; i < numSprites; i ++ ) {

			sprite = sprites[ i ];

			sprite.modelViewMatrix.multiplyMatrices( camera.matrixWorldInverse, sprite.matrixWorld );
			sprite.z = - sprite.modelViewMatrix.elements[ 14 ];

      var fragmentShader = sprite.material.fragmentShader;
      if ( fragmentShader && !sprite.program ) {

        sprite.program = resolveShader( fragmentShader, sprite.material.uniforms );

      }

		}


		sprites.sort( painterSortStable );


		// setup gl

		state.disable( gl.CULL_FACE );
		state.enable( gl.BLEND );

	  gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, elementBuffer );
		state.activeTexture( gl.TEXTURE0 );


		var oldFogType = 0;
		var sceneFogType = 0;
		var fog = scene.fog;

    programs.forEach( function ( program ) {

		  gl.useProgram( program.program );

      var attributes = program.attributes,
          uniforms = program.uniforms;

      state.initAttributes();
  		state.enableAttribute( attributes.position );
  		state.enableAttribute( attributes.uv );
  		state.disableUnusedAttributes();

		  gl.vertexAttribPointer( attributes.position, 2, gl.FLOAT, false, 2 * 8, 0 );
		  gl.vertexAttribPointer( attributes.uv, 2, gl.FLOAT, false, 2 * 8, 8 );

      uniforms.setValue( gl, 'projectionMatrix', camera.projectionMatrix.elements );

		  if ( fog ) {

        uniforms.setValue( gl, 'fogColor', fog.color );

			  if ( fog.isFog ) {

          uniforms.setValue( gl, 'fogNear', fog.near );
          uniforms.setValue( gl, 'fogFar', fog.far );
          uniforms.setValue( gl, 'fogType', 1 );
				  oldFogType = 1;
				  sceneFogType = 1;

			  } else if ( fog.isFogExp2 ) {

          uniforms.setValue( gl, 'fogDensity', fog.density );
          uniforms.setValue( gl, 'fogType', 2 );
				  oldFogType = 2;
				  sceneFogType = 2;

			  }

		  } else {

        uniforms.setValue( gl, 'fogType', 0 );
			  oldFogType = 0;
			  sceneFogType = 0;

		  }
    });


		// render all sprites

		var scale = [];
    var program;

		for ( i = 0; i < numSprites; i ++ ) {

			sprite = sprites[ i ];
			var material = sprite.material;

			if ( material.visible === false ) continue;

      var spriteProgram = sprite.program || defaultProgram;
      if ( sprite.program || program !== spriteProgram ) {

        program = spriteProgram;
        gl.useProgram( program.program );

      }

      THREE.clearTextureUnits();
      var uniforms = spriteProgram.uniforms,
          fragmentUniformsList = spriteProgram.fragmentUniformsList;

      if ( fragmentUniformsList ) {

        THREE.WebGLUniforms.upload( gl, fragmentUniformsList, material.uniforms, renderer );

      } else {

        uniforms.setValue( gl, 'map', 0 );

      }

      uniforms.setValue( gl, 'alphaTest', material.alphaTest );
      uniforms.setValue( gl, 'modelViewMatrix', sprite.modelViewMatrix.elements );

			sprite.matrixWorld.decompose( spritePosition, spriteRotation, spriteScale );

			scale[ 0 ] = spriteScale.x;
			scale[ 1 ] = spriteScale.y;

			var fogType = 0;

			if ( scene.fog && material.fog ) {

				fogType = sceneFogType;

			}

			if ( oldFogType !== fogType ) {

        uniforms.setValue( gl, 'fogType', fogType );
				oldFogType = fogType;

			}

			if ( material.map !== null ) {

        uniforms.setValue( gl, 'uvOffset', material.map.offset );
        uniforms.setValue( gl, 'uvScale', material.map.repeat );

			} else {

        uniforms.setValue( gl, 'uvOffset', [ 0, 0 ]);
        uniforms.setValue( gl, 'uvScale', [ 1, 1 ]);

			}

      uniforms.setValue( gl, 'opacity', material.opacity );
      uniforms.setValue( gl, 'color', material.color );

      uniforms.setValue( gl, 'rotation', material.rotation );
      uniforms.setValue( gl, 'scale', scale );

      uniforms.setValue( gl, 'zOffset', sprite.material.zOffset || 0.0 );

			state.setBlending( material.blending, material.blendEquation, material.blendSrc, material.blendDst );
			state.setDepthTest( material.depthTest );
			state.setDepthWrite( material.depthWrite );

      if ( !fragmentUniformsList ) {

			  if ( material.map ) {

				  renderer.setTexture2D( material.map, 0 );

			  } else {

				  renderer.setTexture2D( texture, 0 );

			  }

      }

			gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );

		}

		// restore gl

		state.enable( gl.CULL_FACE );

		renderer.resetGLState();

	};

  function resolveShader( fragmentSource, fragmentUniforms ) {

    for ( var pi = 0, plen = programs.length; pi < plen; pi++ ) {
      var p = programs[ pi ];

      if ( p.fragmentSource === fragmentSource ) {
        return p;
      }
    }

    var program = new WebGLSpriteProgram( fragmentSource, fragmentUniforms );
    programs.push( program );
    return program;
  }


  /**
   * Similar to WebGLProgram except that it is designed to work with sprites.  This program allows you to provide your own
   * fragment shader.
   */
	function WebGLSpriteProgram ( fragmentSource, fragmentUniforms ) {

		var program = gl.createProgram();

		var vertexShader = gl.createShader( gl.VERTEX_SHADER );
		var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );

		gl.shaderSource( vertexShader, [

			'precision ' + renderer.getPrecision() + ' float;',

			'uniform mat4 modelViewMatrix;',
			'uniform mat4 projectionMatrix;',
			'uniform float rotation;',
			'uniform vec2 scale;',
			'uniform vec2 uvOffset;',
			'uniform vec2 uvScale;',
			'uniform float zOffset;',

			'attribute vec2 position;',
			'attribute vec2 uv;',

			'varying vec2 vUv;',

			'void main() {',

				'vUv = uvOffset + uv * uvScale;',

				'vec2 alignedPosition = position * scale;',

				'vec2 rotatedPosition;',
				'rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;',
				'rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;',

				'vec4 finalPosition;',

				'finalPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );',
				'finalPosition.xy += rotatedPosition;',
        'finalPosition.z += zOffset;',
				'finalPosition = projectionMatrix * finalPosition;',

				'gl_Position = finalPosition;',

			'}'

		].join( '\n' ) );

    if ( fragmentSource ) {
      this.fragmentSource = fragmentSource;
    }

		gl.shaderSource( fragmentShader, fragmentSource ? fragmentSource : [
			'precision ' + renderer.getPrecision() + ' float;',

			'uniform vec3 color;',
			'uniform sampler2D map;',
			'uniform float opacity;',

			'uniform int fogType;',
			'uniform vec3 fogColor;',
			'uniform float fogDensity;',
			'uniform float fogNear;',
			'uniform float fogFar;',
			'uniform float alphaTest;',

			'varying vec2 vUv;',

			'void main() {',

				'vec4 texture = texture2D( map, vUv );',

				'if ( texture.a < alphaTest ) discard;',

				'gl_FragColor = vec4( color * texture.xyz, texture.a * opacity );',

				'if ( fogType > 0 ) {',

					'float depth = gl_FragCoord.z / gl_FragCoord.w;',
					'float fogFactor = 0.0;',

					'if ( fogType == 1 ) {',

						'fogFactor = smoothstep( fogNear, fogFar, depth );',

					'} else {',

						'const float LOG2 = 1.442695;',
						'fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );',
						'fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );',

					'}',

					'gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );',

				'}',

			'}'

		].join( '\n' ) );

		gl.compileShader( vertexShader );
		gl.compileShader( fragmentShader );

		gl.attachShader( program, vertexShader );
		gl.attachShader( program, fragmentShader );

		gl.linkProgram( program );

    if ( fragmentSource ) {
      // assume the built-in shaders linked without error

      if ( gl.getProgramParameter( program, gl.LINK_STATUS ) === false ) {

			  console.error( 'THREE.WebGLSpriteProgram: Could not initialise shader.' );
			  console.error( 'gl.VALIDATE_STATUS', gl.getProgramParameter( program, gl.VALIDATE_STATUS ) );
			  console.error( 'gl.getError()', gl.getError() );

		  }

		  if ( gl.getProgramInfoLog( program ) !== '' ) {

			  console.warn( 'THREE.WebGLSpriteProgram: gl.getProgramInfoLog()', gl.getProgramInfoLog( program ) );

		  }
    }

		this.program = program;

		this.attributes = {
			position:	        gl.getAttribLocation ( program, 'position' ),
			uv:					      gl.getAttribLocation ( program, 'uv' )
		};

    var uniforms = this.uniforms = new THREE.WebGLUniforms( gl, program, renderer );

    if ( fragmentUniforms ) {

      this.fragmentUniformsList = THREE.WebGLUniforms.seqWithValue( uniforms.seq, fragmentUniforms );

    }

		return this;
	}

	function painterSortStable( a, b ) {

		if ( a.renderOrder !== b.renderOrder ) {

			return a.renderOrder - b.renderOrder;

		} else if ( a.z !== b.z ) {

			return b.z - a.z;

		} else {

			return b.id - a.id;

		}

	}

}


export { SpritePlugin };
