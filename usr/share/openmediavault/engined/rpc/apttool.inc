<?php
/*
 * @author    Volker Theile <volker.theile@openmediavault.org>
 * @author    OpenMediaVault Plugin Developers <plugins@omv-extras.org>
 * @copyright Copyright (c) 2009-2013 Volker Theile
 * @copyright Copyright (c) 2016-2019 OpenMediaVault Plugin Developers
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
require_once('openmediavault/globals.inc');

class OMVRpcServiceAptTool extends \OMV\Rpc\ServiceAbstract
{
    public function getName()
    {
        return 'AptTool';
    }

    public function initialize()
    {
        $this->registerMethod('executeSearch');
        $this->registerMethod('getPackageList');
        $this->registerMethod('getPackage');
        $this->registerMethod('setPackage');
        $this->registerMethod('deletePackage');
        $this->registerMethod('getHoldList');
        $this->registerMethod('doCommand');
    }

    public function executeSearch($params, $context)
    {
        // Validate the RPC caller context.
        $this->validateMethodContext($context, ['role' => OMV_ROLE_ADMINISTRATOR]);
        // Validate the parameters of the RPC service method.
        $this->validateMethodParams($params, 'rpc.apttool.executesearch');
        $results = [];
        if (strlen($params['term']) > 1) {
            if ($params['type'] == 'dpkg') {
                $command = 'dpkg -l | grep';
                $command2= '';
            } else {
                $command = 'apt-cache';
                $command2 = $params['type'];
            }
            $cmd = new \OMV\System\Process($command, $command2, escapeshellarg($params['term']));
            $cmd->setQuiet(true);
            $cmd->execute($output);

            if (empty($output)) {
                $results[] = [
                    'packagename' => gettext('No results found.')
                ];
            } else {
                foreach ($output as $line) {
                    if (empty($line))
                        continue;

                    // Prepare configuration data.
                    $results[] = [
                        'packagename' => trim($line)
                    ];
                }
            }
        } else {
            $results[] = [
                'packagename' => gettext('Search must use at least two characters.')
            ];
        }
        // Filter the result.
        return $this->applyFilter($results, $params['start'], $params['limit'],
            $params['sortfield'], $params['sortdir']);
    }

    public function getPackageList($params, $context)
    {
        // Validate the RPC caller context.
        $this->validateMethodContext($context, ['role' => OMV_ROLE_ADMINISTRATOR]);
        // Validate the parameters of the RPC service method.
        $this->validateMethodParams($params, 'rpc.common.getlist');
        // Get the configuration object.
        $db = \OMV\Config\Database::getInstance();
        $objects = $db->get('conf.service.apttool');
        // Add additional share informations.
        $objectsAssoc = [];
        foreach ($objects as $objectk => &$objectv) {
            // Add and update the installed property
            $objectv->add('installed', 'string', gettext("No"));
            $cmdLine = sprintf("dpkg-query -W -f='\${Version}' %s", $objectv->get('packagename'));
            $cmd = new \OMV\System\Process($cmdLine);
            $cmd->setQuiet(true);
            $output = [];
            $cmd->execute($output, $exitStatus);
            if ((0 == $exitStatus) && (!empty($output))) {
                $objectv->set('installed', gettext("Yes") . ' - ' . $output[0]);
            }
            // Add and update the 'hold' property.
            $objectv->add('hold', 'string', gettext("No"));
            $cmd = new \OMV\System\Process('apt-mark showholds', $objectv->get('packagename'));
            $cmd->setQuiet(true);
            $output = [];
            $cmd->execute($output);
            if (!empty($output)) {
                $objectv->set('hold', gettext("Yes"));
            }
            $objectsAssoc[] = $objectv->getAssoc();
        }
        // Filter the result.
        return $this->applyFilter($objectsAssoc, $params['start'], $params['limit'],
            $params['sortfield'], $params['sortdir']);
    }

    public function getPackage($params, $context)
    {
        // Validate the RPC caller context.
        $this->validateMethodContext($context, ['role' => OMV_ROLE_ADMINISTRATOR]);
        // Validate the parameters of the RPC service method.
        $this->validateMethodParams($params, 'rpc.common.objectuuid');
        // Get the configuration object.
        $db = \OMV\Config\Database::getInstance();
        return $db->getAssoc('conf.service.apttool.package', $params['uuid']);
    }

    public function setPackage($params, $context)
    {
        // Validate the RPC caller context.
        $this->validateMethodContext($context, ['role' => OMV_ROLE_ADMINISTRATOR]);
        // Validate the parameters of the RPC service method.
        $this->validateMethodParams($params, 'rpc.apttool.setpackage');
        // Prepare the configuration object.
        $object = new \OMV\Config\ConfigObject('conf.service.apttool');
        $object->setAssoc($params);
        // Set the configuration object.
        $isNew = $object->isNew();
        $db = \OMV\Config\Database::getInstance();
        if (TRUE === $isNew) {
            // Check uniqueness - Packaged folder
            $db->assertIsUnique($object, 'packagename');
        }
        $db->set($object);
        // Return the configuration object.
        return $object->getAssoc();
    }

    public function deletePackage($params, $context)
    {
        // Validate the RPC caller context.
        $this->validateMethodContext($context, ['role' => OMV_ROLE_ADMINISTRATOR]);
        // Validate the parameters of the RPC service method.
        $this->validateMethodParams($params, 'rpc.common.objectuuid');
        // Delete the configuration object.
        $db = \OMV\Config\Database::getInstance();
        $object = $db->get('conf.service.apttool', $params['uuid']);
        $db->delete($object);
        // Return the deleted configuration object.
        return $object->getAssoc();
    }

    public function getHoldList($params, $context)
    {
        // Validate the RPC caller context.
        $this->validateMethodContext($context, ['role' => OMV_ROLE_ADMINISTRATOR]);
        // Validate the parameters of the RPC service method.
        $this->validateMethodParams($params, 'rpc.common.getlist');
        // Get the output of apt-mark showhold
        $cmd = new \OMV\System\Process('apt-mark', 'showhold', ' | sort');
        $cmd->execute($output);
        $packages = [];
        foreach ($output as $package) {
            if (empty($package))
                continue;
            $packages[] = [ 'package' => $package ];
        }
        if (empty($packages)) {
            $packages[] = [ 'package' => gettext("None found.") ];
        }
        return $this->applyFilter($packages, $params['start'], $params['limit'],
            $params['sortfield'], $params['sortdir']);
    }

    public function doCommand($params, $context)
    {
        // Validate the RPC caller context.
        $this->validateMethodContext($context, ['role' => OMV_ROLE_ADMINISTRATOR]);
        // Validate the parameters of the RPC service method.
        $this->validateMethodParams($params, 'rpc.apttool.docommand');
        // Create the background process.
        return $this->execBgProc(function($bgStatusFilename, $bgOutputFilename)
          use ($params) {
            // Install the packages.
            $cmdArgs = [];
            switch ($params['command']) {
                case 'install':
                    $cmdBin = 'apt-get';
                    $cmdArgs[] = '--yes';
                    if ($params['backports'] == 'true') {
                        $cmdArgs[] = '-t $(lsb_release --short --codename)-backports';
                    }
                    $cmdArgs[] = '--fix-missing';
                    $cmdArgs[] = '--allow-unauthenticated';
                    $cmdArgs[] = '--reinstall';
                    break;
                case 'remove':
                    $cmdBin = 'apt-get';
                    $cmdArgs[] = '--yes';
                    $cmdArgs[] = '--auto-remove';
                    $cmdArgs[] = '--purge';
                    break;
                case 'hold':
                case 'unhold':
                    $cmdBin = 'apt-mark';
                    break;
            }
            $cmdArgs[] = $params['command'];
            $cmdArgs[] = $params['packagename'];
            $cmd = new \OMV\System\Process($cmdBin, $cmdArgs);
            $cmd->setEnv('DEBIAN_FRONTEND', 'noninteractive');
            $cmd->setRedirect2to1();
            $cmdLine = $cmd->getCommandLine();
            if (0 !== $this->exec($cmdLine, $output, $bgOutputFilename))
                throw new \OMV\ExecException($cmdLine, $output);
            return $output;
        });
    }
}
