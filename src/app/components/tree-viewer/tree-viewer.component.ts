import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import cytoscape, { Core } from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

export interface TreeNode {
  id: string;
  label: string;
  parentId?: string | null;
}

@Component({
  selector: 'app-tree-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tree-viewer.component.html',
  styleUrls: ['./tree-viewer.component.scss']
})
export class TreeViewerComponent implements AfterViewInit {

  @ViewChild('cyContainer', { static: true }) cyContainer!: ElementRef<HTMLDivElement>;
  private cy!: Core;

  // árbol en memoria
  treeData: TreeNode[] = [];

  // contador interno para IDs automáticos
  private nextId = 1;

  // formularios: NO pedimos id, solo etiqueta y padre
  formRoot = {
    label: ''
  };

  formNode = {
    label: '',
    parentId: null as string | null
  };

  selectedNodeId: string | null = null;
  selectedInfo: {
    label: string;
    parentLabel: string | null;
    childrenLabels: string[];
    siblingsLabels: string[];
    level: number;
    subtreeSize: number;
  } | null = null;

  errorMessage: string | null = null;

  ngAfterViewInit(): void {
    this.initCytoscape();
  }

  // ----------------- Inicialización de Cytoscape -----------------
  private initCytoscape(): void {
    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements: [],
      layout: {
        name: 'dagre',
        rankDir: 'TB'
      } as any,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#1976d2',
            'label': 'data(label)',
            'color': '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'width': '45px',
            'height': '45px'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#999',
            'target-arrow-color': '#999',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#d32f2f'
          }
        }
      ]
    });

    this.cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeId = node.id();
      this.selectedNodeId = nodeId;
      this.selectedInfo = this.computeNodeInfo(nodeId);
    });
  }

  // ----------------- Grafo -----------------
  private refreshGraph(): void {
    const elements = this.buildElementsFromTree(this.treeData);

    this.cy.elements().remove();
    this.cy.add([
      ...elements.nodes,
      ...elements.edges
    ] as any);

    const layout = this.cy.layout({
      name: 'dagre',
      rankDir: 'TB'
    } as any);
    layout.run();
  }

  private buildElementsFromTree(tree: TreeNode[]) {
    const nodes = tree.map(n => ({
      data: { id: n.id, label: n.label }
    }));

    const edges = tree
      .filter(n => n.parentId)
      .map(n => ({
        data: {
          id: `${n.parentId}-${n.id}`,
          source: n.parentId!,
          target: n.id
        }
      }));

    return {
      nodes,
      edges
    };
  }

  // ----------------- Alta de nodos -----------------
  addRoot(): void {
    this.errorMessage = null;

    if (this.treeData.length > 0) {
      this.errorMessage = 'El árbol ya tiene una raíz.';
      return;
    }

    const label = this.formRoot.label.trim();

    if (!label) {
      this.errorMessage = 'La etiqueta de la raíz es obligatoria.';
      return;
    }

    const id = this.generateId();

    this.treeData.push({
      id,
      label: `${label} (raíz)`,
      parentId: null
    });

    this.formRoot.label = '';

    this.selectedInfo = null;
    this.selectedNodeId = null;
    this.refreshGraph();
  }

  addNode(): void {
    this.errorMessage = null;

    const label = this.formNode.label.trim();
    const parentId = this.formNode.parentId;

    if (!label) {
      this.errorMessage = 'La etiqueta del nodo es obligatoria.';
      return;
    }

    if (!parentId) {
      this.errorMessage = 'Debes seleccionar un nodo padre.';
      return;
    }

    const parentExists = this.treeData.some(n => n.id === parentId);
    if (!parentExists) {
      this.errorMessage = 'El nodo padre no existe.';
      return;
    }

    const id = this.generateId();

    this.treeData.push({
      id,
      label,
      parentId
    });

    this.formNode.label = '';
    // dejamos el padre seleccionado

    this.selectedInfo = null;
    this.selectedNodeId = null;
    this.refreshGraph();
  }

  resetTree(): void {
    this.treeData = [];
    this.selectedNodeId = null;
    this.selectedInfo = null;
    this.errorMessage = null;
    this.nextId = 1;

    if (this.cy) {
      this.cy.elements().remove();
    }
  }

  private generateId(): string {
    const id = `n${this.nextId}`;
    this.nextId++;
    return id;
  }

  // ----------------- Cálculos de info del nodo -----------------
  private computeNodeInfo(nodeId: string) {
    const node = this.treeData.find(n => n.id === nodeId)!;

    const parentLabel =
      node.parentId
        ? (this.treeData.find(n => n.id === node.parentId)?.label ?? null)
        : null;

    const childrenLabels = this.treeData
      .filter(n => n.parentId === nodeId)
      .map(n => n.label);

    const siblingsLabels = this.treeData
      .filter(n => n.parentId === node.parentId && n.id !== nodeId)
      .map(n => n.label);

    const level = this.getNodeLevel(nodeId);
    const subtreeSize = this.getSubtreeSize(nodeId);

    return {
      label: node.label,
      parentLabel,
      childrenLabels,
      siblingsLabels,
      level,
      subtreeSize
    };
  }

  private getNodeLevel(nodeId: string): number {
    let level = 0;
    let current = this.treeData.find(n => n.id === nodeId);

    while (current && current.parentId) {
      level++;
      current = this.treeData.find(n => n.id === current!.parentId);
    }

    return level;
  }

  private getSubtreeSize(nodeId: string): number {
    const desc = this.getDescendants(nodeId);
    return desc.length + 1; // incluir el propio nodo
  }

  private getDescendants(nodeId: string): string[] {
    const children = this.treeData
      .filter(n => n.parentId === nodeId)
      .map(n => n.id);

    const all: string[] = [...children];

    for (const c of children) {
      all.push(...this.getDescendants(c));
    }

    return all;
  }

  // Tamaño total del árbol
  get treeSize(): number {
    return this.treeData.length;
  }
}
