/**
 * @author mikael emtinger / http://gomo.se/
 * @author alteredq / http://alteredqualia.com/
 */
THREE.SpritePlugin = function ( renderer, sprites ) {

	var gl = renderer.context;
 
  var vertexBuffer, elementBuffer;
	var defaultProgram;
  var programs = [];
  
  var texture;

  // decompose matrixWorld

	var spritePosition = new THREE.Vector3();
	var spriteRotation = new THREE.Quaternion();
	var spriteScale = new THREE.Vector3();

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
		
		var canvas = document.createElement( 'canvas' );
		canvas.width = 8;
		canvas.height = 8;
		
		var context = canvas.getContext( '2d' );
		context.fillStyle = 'white';
		context.fillRect( 0, 0, 8, 8 );

		texture = new THREE.Texture( canvas );
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

			sprite._modelViewMatrix.multiplyMatrices( camera.matrixWorldInverse, sprite.matrixWorld );
			sprite.z = - sprite._modelViewMatrix.elements[ 14 ];

      var fragmentShader = sprite.material.fragmentShader;
      if ( fragmentShader && !sprite.program ) {

        sprite.program = resolveShader( fragmentShader, sprite.material.fragmentUniforms );

      }

		}


		sprites.sort( painterSortStable );


		// setup gl

		gl.disable( gl.CULL_FACE );
		gl.enable( gl.BLEND );

	  gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, elementBuffer );
		gl.activeTexture( gl.TEXTURE0 );


		var oldFogType = 0;
		var sceneFogType = 0;
		var fog = scene.fog;

    programs.forEach( function ( program ) {
		  gl.useProgram( program.program );

		  gl.enableVertexAttribArray( program.attributes.position );
		  gl.enableVertexAttribArray( program.attributes.uv );

		  gl.vertexAttribPointer( program.attributes.position, 2, gl.FLOAT, false, 2 * 8, 0 );
		  gl.vertexAttribPointer( program.attributes.uv, 2, gl.FLOAT, false, 2 * 8, 8 );


		  gl.uniformMatrix4fv( program.uniforms.projectionMatrix, false, camera.projectionMatrix.elements );

		  gl.uniform1i( program.uniforms.map, 0 );

		  if ( fog ) {

			  gl.uniform3f( program.uniforms.fogColor, fog.color.r, fog.color.g, fog.color.b );

			  if ( fog instanceof THREE.Fog ) {

				  gl.uniform1f( program.uniforms.fogNear, fog.near );
				  gl.uniform1f( program.uniforms.fogFar, fog.far );

				  gl.uniform1i( program.uniforms.fogType, 1 );
				  oldFogType = 1;
				  sceneFogType = 1;

			  } else if ( fog instanceof THREE.FogExp2 ) {

				  gl.uniform1f( program.uniforms.fogDensity, fog.density );

				  gl.uniform1i( program.uniforms.fogType, 2 );
				  oldFogType = 2;
				  sceneFogType = 2;

			  }

		  } else {

			  gl.uniform1i( program.uniforms.fogType, 0 );
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

      var spriteProgram = sprite.program || defaultProgram;
      if ( sprite.program || program !== spriteProgram ) {

        program = spriteProgram;
        gl.useProgram( program.program );
        THREE.clearTextureUnits();
      }

      var fragmentUniforms = material.fragmentUniforms;
      if ( fragmentUniforms ) {

        program.loadUniformsGeneric( fragmentUniforms );

      }

			gl.uniform1f( program.uniforms.alphaTest, material.alphaTest );
			gl.uniformMatrix4fv( program.uniforms.modelViewMatrix, false, sprite._modelViewMatrix.elements );

			sprite.matrixWorld.decompose( spritePosition, spriteRotation, spriteScale );

			scale[ 0 ] = spriteScale.x * 3;
			scale[ 1 ] = spriteScale.y * 3;

			var fogType = 0;

			if ( scene.fog && material.fog ) {

				fogType = sceneFogType;

			}

			if ( oldFogType !== fogType ) {

				gl.uniform1i( program.uniforms.fogType, fogType );
				oldFogType = fogType;

			}

			if ( material.map !== null ) {

				gl.uniform2f( program.uniforms.uvOffset, material.map.offset.x, material.map.offset.y );
				gl.uniform2f( program.uniforms.uvScale, material.map.repeat.x, material.map.repeat.y );

			} else {

				gl.uniform2f( program.uniforms.uvOffset, 0, 0 );
				gl.uniform2f( program.uniforms.uvScale, 1, 1 );

			}

			gl.uniform1f( program.uniforms.opacity, material.opacity );
			gl.uniform3f( program.uniforms.color, material.color.r, material.color.g, material.color.b );

			gl.uniform1f( program.uniforms.rotation, material.rotation );
			gl.uniform2fv( program.uniforms.scale, scale );

      // TODO:  Is there another place we should put the zOffset rather than on the material like this ?
			gl.uniform1f( program.uniforms.zOffset, sprite.material.zOffset || 0.0 );

			renderer.setBlending( material.blending, material.blendEquation, material.blendSrc, material.blendDst );
			renderer.setDepthTest( material.depthTest );
			renderer.setDepthWrite( material.depthWrite );

      if ( !fragmentUniforms ) {

			  if ( material.map && material.map.image && material.map.image.width ) {

				  renderer.setTexture( material.map, 0 );

			  } else {

				  renderer.setTexture( texture, 0 );

			  }

      }

			gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );

		}

		// restore gl

		gl.enable( gl.CULL_FACE );

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
						'float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );',
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

		this.uniforms = {
			uvOffset:			    gl.getUniformLocation( program, 'uvOffset' ),
			uvScale:			    gl.getUniformLocation( program, 'uvScale' ),

			rotation:			    gl.getUniformLocation( program, 'rotation' ),
			scale:				    gl.getUniformLocation( program, 'scale' ),

			zOffset:			    gl.getUniformLocation( program, 'zOffset' ),

			color:				    gl.getUniformLocation( program, 'color' ),
			map:				      gl.getUniformLocation( program, 'map' ),
			opacity:			    gl.getUniformLocation( program, 'opacity' ),

			modelViewMatrix: 	gl.getUniformLocation( program, 'modelViewMatrix' ),
			projectionMatrix:	gl.getUniformLocation( program, 'projectionMatrix' ),

			fogType:			    gl.getUniformLocation( program, 'fogType' ),
			fogDensity:		    gl.getUniformLocation( program, 'fogDensity' ),
			fogNear:			    gl.getUniformLocation( program, 'fogNear' ),
			fogFar:				    gl.getUniformLocation( program, 'fogFar' ),
			fogColor:			    gl.getUniformLocation( program, 'fogColor' ),

			alphaTest:		    gl.getUniformLocation( program, 'alphaTest' )
		};

    if ( fragmentUniforms ) {

      for ( var u in fragmentUniforms ) {

        this.uniforms[ u ] = gl.getUniformLocation( program, u );

      }

    }

    this.loadUniformsGeneric = function( fragmentUniforms ) {

      var uniformsList = [];

      for ( var u in fragmentUniforms ) {

		    uniformsList.push( [ fragmentUniforms[ u ], this.uniforms[ u ] ] );

      }

      THREE.loadUniformsGeneric( uniformsList );

    };

		return this;
	}

	function painterSortStable ( a, b ) {

		if ( a.z !== b.z ) {

			return b.z - a.z;

		} else {

			return b.id - a.id;

		}

	}

};
