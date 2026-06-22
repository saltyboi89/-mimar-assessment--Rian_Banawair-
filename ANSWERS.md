(Q1) 


(a):
GLSL Expression:

gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * (0.3 * sin(2.0 * uTime)), 1.0);

(b):

position:the original vertex position in local object space. is a built in attribute 
amplitude (0.3) :the maximum distance each vertex travels. it controls how dramatic the effect is.
frequency (2.0): controls how many full  cycles occur per second, thus  Higher values = faster breathing.
sin(2.0 * uTime): oscillates between –1 and +1 over the cycle period. allows the vertices to expand and contract in a smooth manner
normal: the unit vector perpendicular to the surface at this vertex Multiplying allows the vertex to move outward from the surface, not in a fixed world direction.

(c):

as the the value of the normal expression is pre-baked. any desplacement will cause cause the the lighting and the surfaces to become misaligned.

fix 1:
as we are using a fixed function with sin. we can construct an approapriate new normal that is aware of the new displacement 
. The displaced surface tangents are computed by differentiating the displacement function with respect to the surface coordinates (u, v), and the new normal is their cross product

fix 2:
use computeVertexNormals() call to recalculate all normals from the post desplacement  triangle faces

(Q2)
(a):
- Too many draw calls: The CPU spends the entire frame just dispatching commands. thus the cpu becomes a major bottleneck to the gpu, preventing it from working at max speed
as for a fix Replace all individual meshes with one single InstancedMesh

-Frustum culling :is Three.js checking whether each object is inside the camera's view before drawing it. If the bounding volumes are unaccurate , Three.js will draws object that are completely off-screen, wasting system resources 
as for the fix  recompute the bounding sphere so Three.js has accurate data to cull against.


(Q3)
The shader applies a horizontal wave distortion to a texture. For every fragment, it takes the fragment's UV coordinate and shifts the U (horizontal) component by a sine function applied to the V (vertical) coordinate, scaled by uTime. The result is that the texture appears to ripple horizontally 





(Q4):

(A): the naive straight foward approch will be to use THREE.Mesh. which will issue a draw call for  each box indivually 
Each draw call requires the driver to validate state and dispatch work to the GPU. as the load will be heavy on the cpu, and gpu will be mostly idle and not using it's full capacity, so no matter how strong the hardware the fps will remain low.

(b): instanced mesh will allow All 10,000 transforms (and colors) to be  uploaded to the GPU in a single buffer.with no involvement from the cpu once the draw call is issued to the gpu, and as the gpu excels at parallelism, it will be able to handle the workload effciently 

(C):
1. All instances must share the same geometry and material. You cannot easily give individual instances different mesh shapes or different shader programs.

2. Transparency / sorting. Instanced rendering renders all instances in buffer order — there's no automatic back-to-front sorting. For translucent instanced objects, you either accept incorrect blending artifacts or implement a custom per-instance depth sort on the CPU, which is costly.

