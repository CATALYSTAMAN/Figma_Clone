"use client";
import { fabric } from "fabric";
import LeftSidebar from "@/components/LeftSidebar";
import Live from "@/components/Live";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import { useEffect, useRef, useState } from "react";
import { handleCanvasMouseDown, handleCanvasMouseUp, handleCanvasObjectModified, handleCanvasObjectScaling, handleCanvasSelectionCreated, handleCanvaseMouseMove, handlePathCreated, handleResize, initializeFabric, renderCanvas } from "@/lib/canvas";
import { ActiveElement, Attributes } from "@/types/type";
import { useMutation, useRedo, useStorage, useUndo } from "@/liveblocks.config";
import { defaultNavElement } from "@/constants";
import { handleDelete, handleKeyDown } from "@/lib/key-events";
import { handleImageUpload } from "@/lib/shapes";

export default function Page() {
  const undo = useUndo();
  const redo = useRedo();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawing = useRef(false);
  const shapeRef = useRef<fabric.Object | null>(null);
  const selectedShapeRef = useRef<string | null>(null);
  const activeObjectRef = useRef<fabric.Object | null>(null);
  const canvasObjects = useStorage((root) => root.canvasObjects);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isEditingRef = useRef(false);

  const syncShapeInStorage = useMutation(({ storage }, object) => {
    if (!object) return;
    const { objectId } = object;

    const shapeData = object.toJSON();
    shapeData.objectId = objectId;

    const canvasObjects = storage.get("canvasObjects");
    canvasObjects.set(objectId, shapeData);
  }, []);

  const [activeElement, setActiveElement] = useState<ActiveElement>({
    name: "",
    value: "",
    icon: "",
  });

  const deleteAllShapes = useMutation(({ storage }) => {
    // Get the canvasObjects store
    const canvasObjects = storage.get("canvasObjects");
  
    // If the store doesn't exist or is empty, return true
    if (!canvasObjects || canvasObjects.size === 0) 
    return true; // Return an array with length 1 indicating success
    
    for (const [key, value] of canvasObjects.entries()) {
      canvasObjects.delete(key)
    }
    // Return true if the store is empty
    return [canvasObjects.size === 0]; // Return an array with length 1 indicating success
  }, []);

  const deleteShapeFromStorage = useMutation(({ storage }, objectId) => {
    const canvasObjects = storage.get("canvasObjects");
    canvasObjects.delete(objectId);
  }, []);

  const handleActiveElement = (elem: ActiveElement) => {
    setActiveElement(elem);

    switch (elem?.value) {
      case "reset":
        // clear the storage
        deleteAllShapes();
        // clear the canvas
        fabricRef.current?.clear();
        // set "select" as the active element
        setActiveElement(defaultNavElement);
        break;
        
        case "delete":
          // delete it from the canvas
          handleDelete(fabricRef.current as any, deleteShapeFromStorage);
          // set "select" as the active element
          setActiveElement(defaultNavElement);
          break;

        case "image":
          // trigger the click event on the input element which opens the file dialog
          imageInputRef.current?.click();
          isDrawing.current = false;
          if (fabricRef.current) {
          // disable the drawing mode of canvas
          fabricRef.current.isDrawingMode = false;
         }
          break;
      // for comments, do nothing
      case "comments":
        break;

      default:
        // set the selected shape to the selected element
        selectedShapeRef.current = elem?.value as string;
        break;
    }
  };

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: "",
    height: "",
    fontSize: "",
    fontFamily: "",
    fontWeight: "",
    fill: "#aabbcc",
    stroke: "#aabbcc",
  });

  useEffect(() => {
    const canvas = initializeFabric({ canvasRef, fabricRef });
    
    canvas.on("mouse:down", (options: any) => {
      handleCanvasMouseDown({
        options,
        canvas,
        isDrawing,
        shapeRef,
        selectedShapeRef,
      });
    });

    canvas.on("mouse:move", (options: any) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        shapeRef,
        selectedShapeRef,
        syncShapeInStorage,
      });
    });

    canvas.on("mouse:up", () => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        selectedShapeRef,
        syncShapeInStorage,
        setActiveElement,
        activeObjectRef,
      });
    });

    canvas.on("object:modified", (options: any) => {
      handleCanvasObjectModified({
        options,
        syncShapeInStorage,
      });
    });

    canvas.on("selection:created", (options: any) => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      });
    });

    canvas.on("object:scaling", (options) => {
      handleCanvasObjectScaling({
        options, setElementAttributes
      });
    });

    canvas.on("path:created", (options) => {
      handlePathCreated({
        options,
        syncShapeInStorage,
      });
    });
    
    window.addEventListener("resize", () => {
      handleResize({
        canvas: fabricRef.current,
      });
    });

    window.addEventListener("keydown", (e: any) =>
    handleKeyDown({
      e,
      canvas: fabricRef.current,
      undo,
      redo,
      syncShapeInStorage,
      deleteShapeFromStorage,
    })
  );

    return () => {
      canvas.dispose();

      window.removeEventListener("resize", () => {
        handleResize({
          canvas: null,
        });
      });

      window.removeEventListener("keydown", (e) =>
      handleKeyDown({
        e,
        canvas: fabricRef.current,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      })
    );

    }

  }, [])

  useEffect(() => {
    renderCanvas({
      fabricRef,
      canvasObjects,
      activeObjectRef,
    });
  }, [canvasObjects]);

  return (
    <main className="h-screen overflow-hidden">
    <Navbar
      activeElement={activeElement}
      handleActiveElement={handleActiveElement}
      imageInputRef={imageInputRef}
      handleImageUpload={(e: any) => {
        e.stopPropagation();
        handleImageUpload({
          file: e.target.files[0],
          canvas: fabricRef as any,
          shapeRef,
          syncShapeInStorage,
        });
      }}
    /> 

    <section className="flex h-full flex-row">
    <LeftSidebar allShapes={Array.from(canvasObjects)} />
    <Live canvasRef={canvasRef} undo={undo} redo={redo}/>
    <RightSidebar 
      elementAttributes={elementAttributes}
      setElementAttributes={setElementAttributes}
      fabricRef={fabricRef}
      isEditingRef={isEditingRef}
      activeObjectRef={activeObjectRef}
      syncShapeInStorage={syncShapeInStorage}


    />
    </section>
    </main>
  );
}