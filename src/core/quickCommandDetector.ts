import { QuickCommand, QuickCommandGroup, ProjectConfig } from '../types';
import { getEnabledProjects, hasValidLocalPath, hasValidRemoteDirectory } from '../config';

const VARIABLE_PATTERN = /\{(\w+)\}/g;

const LOCAL_PATH_VARIABLES = ['filePath', 'fileName', 'fileDir', 'localPath', 'localDir', 'localFileName'];
const REMOTE_DIR_VARIABLES = ['remoteDir'];

export class QuickCommandDetector {
    constructor() {}

    getQuickCommands(): QuickCommandGroup[] {
        const projects = getEnabledProjects();

        if (projects.length === 0) {
            return [];
        }

        const groups: QuickCommandGroup[] = [];

        for (const project of projects) {
            if (!project.commands || project.commands.length === 0) {
                continue;
            }

            const quickCommands = project.commands.filter(cmd => {
                if (cmd.selectable !== true) {
                    return false;
                }

                if (!this.canExecuteCommand(cmd.executeCommand, project)) {
                    return false;
                }

                return true;
            });

            if (quickCommands.length > 0) {
                groups.push({
                    projectName: project.name,
                    project: project,
                    commands: quickCommands.map(cmd => ({
                        name: cmd.name,
                        executeCommand: cmd.executeCommand,
                        projectName: project.name,
                        project: project
                    }))
                });
            }
        }

        return groups;
    }

    private canExecuteCommand(command: string, project: ProjectConfig): boolean {
        const variables = this.extractVariables(command);
        
        if (variables.length === 0) {
            return true;
        }
        
        const hasLocalPathVar = variables.some(v => LOCAL_PATH_VARIABLES.includes(v));
        const hasRemoteDirVar = variables.some(v => REMOTE_DIR_VARIABLES.includes(v));
        
        if (hasLocalPathVar && !hasValidLocalPath(project)) {
            return false;
        }
        
        if (hasRemoteDirVar && !hasValidRemoteDirectory(project)) {
            return false;
        }
        
        return true;
    }

    private extractVariables(command: string): string[] {
        const matches = command.match(VARIABLE_PATTERN);
        if (!matches) {
            return [];
        }
        return matches.map(m => m.slice(1, -1));
    }

    hasVariables(command: string): boolean {
        return VARIABLE_PATTERN.test(command);
    }

    getSelectableCommands(project: ProjectConfig): { name: string; executeCommand: string }[] {
        if (!project.commands || project.commands.length === 0) {
            return [];
        }

        return project.commands
            .filter(cmd => cmd.selectable === true)
            .map(cmd => ({
                name: cmd.name,
                executeCommand: cmd.executeCommand
            }));
    }
}
