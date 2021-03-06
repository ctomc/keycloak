Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

module.controller('ClientRoleListCtrl', function($scope, $location, realm, client, roles) {
    $scope.realm = realm;
    $scope.roles = roles;
    $scope.client = client;

    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });
});

module.controller('ClientCredentialsCtrl', function($scope, $location, realm, client, ClientCredentials, Notifications) {
    $scope.realm = realm;
    $scope.client = client;
    var secret = ClientCredentials.get({ realm : realm.realm, client : client.id },
        function() {
            $scope.secret = secret.value;
        }
    );

    $scope.changePassword = function() {
        var secret = ClientCredentials.update({ realm : realm.realm, client : client.id },
            function() {
                Notifications.success('The secret has been changed.');
                $scope.secret = secret.value;
            },
            function() {
                Notifications.error("The secret was not changed due to a problem.");
                $scope.secret = "error";
            }
        );
    };

    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });
});

module.controller('ClientIdentityProviderCtrl', function($scope, $location, $route, realm, client, Client, $location, Notifications) {
    $scope.realm = realm;
    $scope.client = angular.copy(client);
    var length = 0;

    if ($scope.client.identityProviders) {
        length = $scope.client.identityProviders.length;

        for (i = 0; i < $scope.client.identityProviders.length; i++) {
            var clientProvider = $scope.client.identityProviders[i];
            if (clientProvider.retrieveToken) {
                clientProvider.retrieveToken = clientProvider.retrieveToken.toString();
            }
        }

    } else {
        $scope.client.identityProviders = [];
    }

    $scope.identityProviders = [];
    var providersMissingInClient = [];

    for (j = 0; j < realm.identityProviders.length; j++) {
        var identityProvider = realm.identityProviders[j];
        var clientProvider = null;

        for (i = 0; i < $scope.client.identityProviders.length; i++) {
            clientProvider = $scope.client.identityProviders[i];

            if (clientProvider) {

                if (clientProvider.id == identityProvider.id) {
                    $scope.identityProviders[i] = {};
                    $scope.identityProviders[i].identityProvider = identityProvider;
                    $scope.identityProviders[i].retrieveToken = clientProvider.retrieveToken;
                    break;
                }

                clientProvider = null;
            }
        }

        if (clientProvider == null) {
            providersMissingInClient.push(identityProvider);
        }
    }

    for (j = 0; j < providersMissingInClient.length; j++) {
        var identityProvider = providersMissingInClient[j];

        var currentProvider = {};
        currentProvider.identityProvider = identityProvider;
        currentProvider.retrieveToken = "false";
        $scope.identityProviders.push(currentProvider);

        var currentClientProvider = {};
        currentClientProvider.id = identityProvider.id;
        currentClientProvider.retrieveToken = "false";
        $scope.client.identityProviders.push(currentClientProvider);
    }

    var oldCopy = angular.copy($scope.client);

    $scope.save = function() {

        Client.update({
            realm : realm.realm,
            client : client.id
        }, $scope.client, function() {
            $scope.changed = false;
            $route.reload();
            Notifications.success("Your changes have been saved to the client.");
        });
    };

    $scope.reset = function() {
        $scope.client = angular.copy(oldCopy);
        $scope.changed = false;
    };

    $scope.$watch('client', function() {
        if (!angular.equals($scope.client, oldCopy)) {
            $scope.changed = true;
        }
    }, true);
});

module.controller('ClientSamlKeyCtrl', function($scope, $location, $http, $upload, realm, client,
                                                         ClientCertificate, ClientCertificateGenerate,
                                                         ClientCertificateDownload, Notifications) {
    $scope.realm = realm;
    $scope.client = client;

    var signingKeyInfo = ClientCertificate.get({ realm : realm.realm, client : client.id, attribute: 'saml.signing' },
        function() {
            $scope.signingKeyInfo = signingKeyInfo;
        }
    );

    $scope.generateSigningKey = function() {
        var keyInfo = ClientCertificateGenerate.generate({ realm : realm.realm, client : client.id, attribute: 'saml.signing' },
            function() {
                Notifications.success('Signing key has been regenerated.');
                $scope.signingKeyInfo = keyInfo;
            },
            function() {
                Notifications.error("Signing key was not regenerated.");
            }
        );
    };

    $scope.importSigningKey = function() {
        $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/saml/Signing/import/saml.signing");
    };

    $scope.exportSigningKey = function() {
        $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/saml/Signing/export/saml.signing");
    };

    var encryptionKeyInfo = ClientCertificate.get({ realm : realm.realm, client : client.id, attribute: 'saml.encryption' },
        function() {
            $scope.encryptionKeyInfo = encryptionKeyInfo;
        }
    );

    $scope.generateEncryptionKey = function() {
        var keyInfo = ClientCertificateGenerate.generate({ realm : realm.realm, client : client.id, attribute: 'saml.encryption' },
            function() {
                Notifications.success('Encryption key has been regenerated.');
                $scope.encryptionKeyInfo = keyInfo;
            },
            function() {
                Notifications.error("Encryption key was not regenerated.");
            }
        );
    };

    $scope.importEncryptionKey = function() {
        $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/saml/Encryption/import/saml.encryption");
    };

    $scope.exportEncryptionKey = function() {
        $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/saml/Encryption/export/saml.encryption");
    };


    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });
});

module.controller('ClientCertificateImportCtrl', function($scope, $location, $http, $upload, realm, client, $routeParams,
                                                         ClientCertificate, ClientCertificateGenerate,
                                                         ClientCertificateDownload, Notifications) {

    var keyType = $routeParams.keyType;
    var attribute = $routeParams.attribute;
    $scope.realm = realm;
    $scope.client = client;
    $scope.keyType = keyType;

    $scope.files = [];

    $scope.onFileSelect = function($files) {
        $scope.files = $files;
    };

    $scope.clearFileSelect = function() {
        $scope.files = null;
    }

    $scope.keyFormats = [
        "JKS",
        "PKCS12"
    ];

    $scope.uploadKeyFormat = $scope.keyFormats[0];

    $scope.uploadFile = function() {
        //$files: an array of files selected, each file has name, size, and type.
        for (var i = 0; i < $scope.files.length; i++) {
            var $file = $scope.files[i];
            $scope.upload = $upload.upload({
                url: authUrl + '/admin/realms/' + realm.realm + '/clients-by-id/' + client.id + '/certificates/' + attribute + '/upload',
                // method: POST or PUT,
                // headers: {'headerKey': 'headerValue'}, withCredential: true,
                data: {keystoreFormat: $scope.uploadKeyFormat,
                    keyAlias: $scope.uploadKeyAlias,
                    keyPassword: $scope.uploadKeyPassword,
                    storePassword: $scope.uploadStorePassword
                },
                file: $file
                /* set file formData name for 'Content-Desposition' header. Default: 'file' */
                //fileFormDataName: myFile,
                /* customize how data is added to formData. See #40#issuecomment-28612000 for example */
                //formDataAppender: function(formData, key, val){}
            }).success(function(data, status, headers) {
                Notifications.success("Keystore uploaded successfully.");
                $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/saml/keys");
            })
                .error(function() {
                    Notifications.error("The key store can not be uploaded. Please verify the file.");

                });
            //.then(success, error, progress);
        }
    };

    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });
});

module.controller('ClientCertificateExportCtrl', function($scope, $location, $http, $upload, realm, client, $routeParams,
                                                         ClientCertificate, ClientCertificateGenerate,
                                                         ClientCertificateDownload, Notifications) {
    var keyType = $routeParams.keyType;
    var attribute = $routeParams.attribute;
    $scope.realm = realm;
    $scope.client = client;
    $scope.keyType = keyType;
    var jks = {
        keyAlias: client.clientId,
        realmAlias: realm.realm
    };

    $scope.keyFormats = [
        "JKS",
        "PKCS12"
    ];

    var keyInfo = ClientCertificate.get({ realm : realm.realm, client : client.id, attribute: attribute },
        function() {
            $scope.keyInfo = keyInfo;
        }
    );
    $scope.jks = jks;
    $scope.jks.format = $scope.keyFormats[0];

    $scope.download = function() {
        $http({
            url: authUrl + '/admin/realms/' + realm.realm + '/clients-by-id/' + client.id + '/certificates/' + attribute + '/download',
            method: 'POST',
            responseType: 'arraybuffer',
            data: $scope.jks,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'client/octet-stream'
            }
        }).success(function(data){
            var blob = new Blob([data], {
                type: 'client/octet-stream'
            });
            var ext = ".jks";
            if ($scope.jks.format == 'PKCS12') ext = ".p12";
            saveAs(blob, 'keystore' + ext);
        }).error(function(){
            Notifications.error("Error downloading.");
        });
    }

    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });
});

module.controller('ClientSessionsCtrl', function($scope, realm, sessionCount, client,
                                                      ClientUserSessions) {
    $scope.realm = realm;
    $scope.count = sessionCount.count;
    $scope.sessions = [];
    $scope.client = client;

    $scope.page = 0;

    $scope.query = {
        realm : realm.realm,
        client: $scope.client.id,
        max : 5,
        first : 0
    }

    $scope.firstPage = function() {
        $scope.query.first = 0;
        if ($scope.query.first < 0) {
            $scope.query.first = 0;
        }
        $scope.loadUsers();
    }

    $scope.previousPage = function() {
        $scope.query.first -= parseInt($scope.query.max);
        if ($scope.query.first < 0) {
            $scope.query.first = 0;
        }
        $scope.loadUsers();
    }

    $scope.nextPage = function() {
        $scope.query.first += parseInt($scope.query.max);
        $scope.loadUsers();
    }

    $scope.toDate = function(val) {
        return new Date(val);
    };

    $scope.loadUsers = function() {
        ClientUserSessions.query($scope.query, function(updated) {
            $scope.sessions = updated;
        })
    };
});

module.controller('ClientRoleDetailCtrl', function($scope, realm, client, role, roles, clients,
                                                        Role, ClientRole, RoleById, RoleRealmComposites, RoleClientComposites,
                                                        $http, $location, Dialog, Notifications) {
    $scope.realm = realm;
    $scope.client = client;
    $scope.role = angular.copy(role);
    $scope.create = !role.name;

    $scope.changed = $scope.create;

    $scope.save = function() {
        if ($scope.create) {
            ClientRole.save({
                realm: realm.realm,
                client : client.id
            }, $scope.role, function (data, headers) {
                $scope.changed = false;
                role = angular.copy($scope.role);

                ClientRole.get({ realm: realm.realm, client : client.id, role: role.name }, function(role) {
                    var id = role.id;
                    $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/roles/" + id);
                    Notifications.success("The role has been created.");
                });
            });
        } else {
            $scope.update();
        }
    };

    $scope.remove = function() {
        Dialog.confirmDelete($scope.role.name, 'role', function() {
            $scope.role.$remove({
                realm : realm.realm,
                client : client.id,
                role : $scope.role.id
            }, function() {
                $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/roles");
                Notifications.success("The role has been deleted.");
            });
        });
    };

    $scope.cancel = function () {
        $location.url("/realms/" + realm.realm + "/clients/" + client.id + "/roles");
    };


    roleControl($scope, realm, role, roles, clients,
        ClientRole, RoleById, RoleRealmComposites, RoleClientComposites,
        $http, $location, Notifications, Dialog);

});

module.controller('ClientImportCtrl', function($scope, $location, $upload, realm, serverInfo, Notifications) {

    $scope.realm = realm;
    $scope.configFormats = serverInfo.clientImporters;
    $scope.configFormat = null;

    $scope.files = [];

    $scope.onFileSelect = function($files) {
        $scope.files = $files;
    };

    $scope.clearFileSelect = function() {
        $scope.files = null;
    }

    $scope.uploadFile = function() {
        //$files: an array of files selected, each file has name, size, and type.
        for (var i = 0; i < $scope.files.length; i++) {
            var $file = $scope.files[i];
            $scope.upload = $upload.upload({
                url: authUrl + '/admin/realms/' + realm.realm + '/client-importers/' + $scope.configFormat.id + '/upload',
                // method: POST or PUT,
                // headers: {'headerKey': 'headerValue'}, withCredential: true,
                data: {myObj: ""},
                file: $file
                /* set file formData name for 'Content-Desposition' header. Default: 'file' */
                //fileFormDataName: myFile,
                /* customize how data is added to formData. See #40#issuecomment-28612000 for example */
                //formDataAppender: function(formData, key, val){}
            }).success(function(data, status, headers) {
                Notifications.success("Uploaded successfully.");
                $location.url("/realms/" + realm.realm + "/clients");
            })
                .error(function() {
                    Notifications.error("The file can not be uploaded. Please verify the file.");

                });
            //.then(success, error, progress);
        }
    };

    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });
});


module.controller('ClientListCtrl', function($scope, realm, clients, Client, serverInfo, $location) {
    $scope.realm = realm;
    $scope.clients = clients;
    $scope.importButton = serverInfo.clientImporters.length > 0;
    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });
});

module.controller('ClientInstallationCtrl', function($scope, realm, client, ClientInstallation,ClientInstallationJBoss, $http, $routeParams) {
    $scope.realm = realm;
    $scope.client = client;
    $scope.installation = null;
    $scope.download = null;
    $scope.configFormat = null;

    $scope.configFormats = [
        "keycloak.json",
        "Wildfly/JBoss Subsystem XML"
    ];

    $scope.changeFormat = function() {
        if ($scope.configFormat == "keycloak.json") {
            var url = ClientInstallation.url({ realm: $routeParams.realm, client: $routeParams.client });
            $http.get(url).success(function(data) {
                var tmp = angular.fromJson(data);
                $scope.installation = angular.toJson(tmp, true);
                $scope.type = 'application/json';
            })
        } else if ($scope.configFormat == "Wildfly/JBoss Subsystem XML") {
            var url = ClientInstallationJBoss.url({ realm: $routeParams.realm, client: $routeParams.client });
            $http.get(url).success(function(data) {
                $scope.installation = data;
                $scope.type = 'text/xml';
            })
        }
    };

    $scope.download = function() {
        saveAs(new Blob([$scope.installation], { type: $scope.type }), 'keycloak.json');
    }
});

module.controller('ClientDetailCtrl', function($scope, realm, client, serverInfo, Client, $location, Dialog, Notifications) {
    $scope.accessTypes = [
        "confidential",
        "public",
        "bearer-only"
    ];

    $scope.protocols = serverInfo.protocols;

    $scope.signatureAlgorithms = [
        "RSA_SHA1",
        "RSA_SHA256",
        "RSA_SHA512",
        "DSA_SHA1"
    ];
    $scope.nameIdFormats = [
        "username",
        "email",
        "transient",
        "persistent"
    ];

    $scope.realm = realm;
    $scope.create = !client.clientId;
    $scope.samlAuthnStatement = false;
    $scope.samlMultiValuedRoles = false;
    $scope.samlServerSignature = false;
    $scope.samlAssertionSignature = false;
    $scope.samlClientSignature = false;
    $scope.samlEncrypt = false;
    $scope.samlForcePostBinding = false;
    $scope.samlForceNameIdFormat = false;
    if (!$scope.create) {
        if (!client.attributes) {
            client.attributes = {};
        }
        $scope.client= angular.copy(client);
        $scope.accessType = $scope.accessTypes[0];
        if (client.bearerOnly) {
            $scope.accessType = $scope.accessTypes[2];
        } else if (client.publicClient) {
            $scope.accessType = $scope.accessTypes[1];
        }
        if (client.protocol) {
            $scope.protocol = $scope.protocols[$scope.protocols.indexOf(client.protocol)];
        } else {
            $scope.protocol = $scope.protocols[0];
        }
        if (client.attributes['saml.signature.algorithm'] == 'RSA_SHA1') {
            $scope.signatureAlgorithm = $scope.signatureAlgorithms[0];
        } else if (client.attributes['saml.signature.algorithm'] == 'RSA_SHA256') {
            $scope.signatureAlgorithm = $scope.signatureAlgorithms[1];
        } else if (client.attributes['saml.signature.algorithm'] == 'RSA_SHA512') {
            $scope.signatureAlgorithm = $scope.signatureAlgorithms[2];
        } else if (client.attributes['saml.signature.algorithm'] == 'DSA_SHA1') {
            $scope.signatureAlgorithm = $scope.signatureAlgorithms[3];
        }
        if (client.attributes['saml_name_id_format'] == 'unspecified') {
            $scope.nameIdFormat = $scope.nameIdFormats[0];
        } else if (client.attributes['saml_name_id_format'] == 'email') {
            $scope.nameIdFormat = $scope.nameIdFormats[1];
        } else if (client.attributes['saml_name_id_format'] == 'transient') {
            $scope.nameIdFormat = $scope.nameIdFormats[2];
        } else if (client.attributes['saml_name_id_format'] == 'persistent') {
            $scope.nameIdFormat = $scope.nameIdFormats[3];
        }

    } else {
        $scope.client = { enabled: true, attributes: {}};
        $scope.client.redirectUris = [];
        $scope.accessType = $scope.accessTypes[0];
        $scope.protocol = $scope.protocols[0];
        $scope.signatureAlgorithm = $scope.signatureAlgorithms[1];
        $scope.nameIdFormat = $scope.nameIdFormats[0];
        $scope.samlAuthnStatement = true;
        $scope.samlForceNameIdFormat = false;
    }

    if ($scope.client.attributes["saml.server.signature"]) {
        if ($scope.client.attributes["saml.server.signature"] == "true") {
            $scope.samlServerSignature = true;
        } else {
            $scope.samlServerSignature = false;

        }
    }
    if ($scope.client.attributes["saml.assertion.signature"]) {
        if ($scope.client.attributes["saml.assertion.signature"] == "true") {
            $scope.samlAssertionSignature = true;
        } else {
            $scope.samlAssertionSignature = false;
        }
    }
    if ($scope.client.attributes["saml.client.signature"]) {
        if ($scope.client.attributes["saml.client.signature"] == "true") {
            $scope.samlClientSignature = true;
        } else {
            $scope.samlClientSignature = false;
        }
    }
    if ($scope.client.attributes["saml.encrypt"]) {
        if ($scope.client.attributes["saml.encrypt"] == "true") {
            $scope.samlEncrypt = true;
        } else {
            $scope.samlEncrypt = false;
        }
    }
    if ($scope.client.attributes["saml.authnstatement"]) {
        if ($scope.client.attributes["saml.authnstatement"] == "true") {
            $scope.samlAuthnStatement = true;
        } else {
            $scope.samlAuthnStatement = false;
        }
    }
    if ($scope.client.attributes["saml_force_name_id_format"]) {
        if ($scope.client.attributes["saml_force_name_id_format"] == "true") {
            $scope.samlForceNameIdFormat = true;
        } else {
            $scope.samlForceNameIdFormat = false;
        }
    }
    if ($scope.client.attributes["saml.multivalued.roles"]) {
        if ($scope.client.attributes["saml.multivalued.roles"] == "true") {
            $scope.samlMultiValuedRoles = true;
        } else {
            $scope.samlMultiValuedRoles = false;
        }
    }
    if ($scope.client.attributes["saml.force.post.binding"]) {
        if ($scope.client.attributes["saml.force.post.binding"] == "true") {
            $scope.samlForcePostBinding = true;
        } else {
            $scope.samlForcePostBinding = false;
        }
    }

    $scope.switchChange = function() {
        $scope.changed = true;
    }

    $scope.changeAccessType = function() {
        if ($scope.accessType == "confidential") {
            $scope.client.bearerOnly = false;
            $scope.client.publicClient = false;
        } else if ($scope.accessType == "public") {
            $scope.client.bearerOnly = false;
            $scope.client.publicClient = true;
        } else if ($scope.accessType == "bearer-only") {
            $scope.client.bearerOnly = true;
            $scope.client.publicClient = false;
        }
    };

    $scope.changeProtocol = function() {
        if ($scope.protocol == "openid-connect") {
            $scope.client.protocol = "openid-connect";
        } else if ($scope.accessType == "saml") {
            $scope.client.protocol = "saml";
        }
    };

    $scope.changeAlgorithm = function() {
        $scope.client.attributes['saml.signature.algorithm'] = $scope.signatureAlgorithm;
    };

    $scope.changeNameIdFormat = function() {
        $scope.client.attributes['saml_name_id_format'] = $scope.nameIdFormat;
    };

    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });

    $scope.$watch('client', function() {
        if (!angular.equals($scope.client, client)) {
            $scope.changed = true;
        }
    }, true);

    $scope.deleteWebOrigin = function(index) {
        $scope.client.webOrigins.splice(index, 1);
    }
    $scope.addWebOrigin = function() {
        $scope.client.webOrigins.push($scope.newWebOrigin);
        $scope.newWebOrigin = "";
    }
    $scope.deleteRedirectUri = function(index) {
        $scope.client.redirectUris.splice(index, 1);
    }
    $scope.addRedirectUri = function() {
        $scope.client.redirectUris.push($scope.newRedirectUri);
        $scope.newRedirectUri = "";
    }

    $scope.save = function() {
        if ($scope.samlServerSignature == true) {
            $scope.client.attributes["saml.server.signature"] = "true";
        } else {
            $scope.client.attributes["saml.server.signature"] = "false";

        }
        if ($scope.samlAssertionSignature == true) {
            $scope.client.attributes["saml.assertion.signature"] = "true";
        } else {
            $scope.client.attributes["saml.assertion.signature"] = "false";
        }
        if ($scope.samlClientSignature == true) {
            $scope.client.attributes["saml.client.signature"] = "true";
        } else {
            $scope.client.attributes["saml.client.signature"] = "false";

        }
        if ($scope.samlEncrypt == true) {
            $scope.client.attributes["saml.encrypt"] = "true";
        } else {
            $scope.client.attributes["saml.encrypt"] = "false";

        }
        if ($scope.samlAuthnStatement == true) {
            $scope.client.attributes["saml.authnstatement"] = "true";
        } else {
            $scope.client.attributes["saml.authnstatement"] = "false";

        }
        if ($scope.samlForceNameIdFormat == true) {
            $scope.client.attributes["saml_force_name_id_format"] = "true";
        } else {
            $scope.client.attributes["saml_force_name_id_format"] = "false";

        }
        if ($scope.samlMultiValuedRoles == true) {
            $scope.client.attributes["saml.multivalued.roles"] = "true";
        } else {
            $scope.client.attributes["saml.multivalued.roles"] = "false";

        }
        if ($scope.samlForcePostBinding == true) {
            $scope.client.attributes["saml.force.post.binding"] = "true";
        } else {
            $scope.client.attributes["saml.force.post.binding"] = "false";

        }

        $scope.client.protocol = $scope.protocol;
        $scope.client.attributes['saml.signature.algorithm'] = $scope.signatureAlgorithm;
        $scope.client.attributes['saml_name_id_format'] = $scope.nameIdFormat;

        if ($scope.client.protocol != 'saml' && !$scope.client.bearerOnly && (!$scope.client.redirectUris || $scope.client.redirectUris.length == 0)) {
            Notifications.error("You must specify at least one redirect uri");
        } else {
            if ($scope.create) {
                Client.save({
                    realm: realm.realm,
                    client: ''
                }, $scope.client, function (data, headers) {
                    $scope.changed = false;
                    var l = headers().location;
                    var id = l.substring(l.lastIndexOf("/") + 1);
                    $location.url("/realms/" + realm.realm + "/clients/" + id);
                    Notifications.success("The client has been created.");
                });
            } else {
                Client.update({
                    realm : realm.realm,
                    client : client.id
                }, $scope.client, function() {
                    $scope.changed = false;
                    client = angular.copy($scope.client);
                    $location.url("/realms/" + realm.realm + "/clients/" + client.id);
                    Notifications.success("Your changes have been saved to the client.");
                });
            }
        }
    };

    $scope.reset = function() {
        $scope.client = angular.copy(client);
        $scope.changed = false;
    };

    $scope.cancel = function() {
        $location.url("/realms/" + realm.realm + "/clients");
    };

    $scope.remove = function() {
        Dialog.confirmDelete($scope.client.clientId, 'client', function() {
            $scope.client.$remove({
                realm : realm.realm,
                client : $scope.client.id
            }, function() {
                $location.url("/realms/" + realm.realm + "/clients");
                Notifications.success("The client has been deleted.");
            });
        });
    };


});

module.controller('ClientScopeMappingCtrl', function($scope, $http, realm, client, clients, Notifications,
                                                          Client,
                                                          ClientRealmScopeMapping, ClientClientScopeMapping, ClientRole,
                                                          ClientAvailableRealmScopeMapping, ClientAvailableClientScopeMapping,
                                                          ClientCompositeRealmScopeMapping, ClientCompositeClientScopeMapping) {
    $scope.realm = realm;
    $scope.client = angular.copy(client);
    $scope.selectedRealmRoles = [];
    $scope.selectedRealmMappings = [];
    $scope.realmMappings = [];
    $scope.clients = clients;
    $scope.clientRoles = [];
    $scope.clientComposite = [];
    $scope.selectedClientRoles = [];
    $scope.selectedClientMappings = [];
    $scope.clientMappings = [];
    $scope.dummymodel = [];


    $scope.changeFullScopeAllowed = function() {
        Client.update({
            realm : realm.realm,
            client : client.id
        }, $scope.client, function() {
            $scope.changed = false;
            client = angular.copy($scope.client);
            updateRealmRoles();
            Notifications.success("Scope mappings updated.");
        });
    }



    function updateRealmRoles() {
        $scope.realmRoles = ClientAvailableRealmScopeMapping.query({realm : realm.realm, client : client.id});
        $scope.realmMappings = ClientRealmScopeMapping.query({realm : realm.realm, client : client.id});
        $scope.realmComposite = ClientCompositeRealmScopeMapping.query({realm : realm.realm, client : client.id});
    }

    function updateClientRoles() {
        if ($scope.targetClient) {
            $scope.clientRoles = ClientAvailableClientScopeMapping.query({realm : realm.realm, client : client.id, targetClient : $scope.targetClient.id});
            $scope.clientMappings = ClientClientScopeMapping.query({realm : realm.realm, client : client.id, targetClient : $scope.targetClient.id});
            $scope.clientComposite = ClientCompositeClientScopeMapping.query({realm : realm.realm, client : client.id, targetClient : $scope.targetClient.id});
        } else {
            $scope.clientRoles = null;
            $scope.clientMappings = null;
            $scope.clientComposite = null;
        }
    }

    $scope.changeClient = function() {
        updateClientRoles();
    };

    $scope.addRealmRole = function() {
        $http.post(authUrl + '/admin/realms/' + realm.realm + '/clients-by-id/' + client.id + '/scope-mappings/realm',
                $scope.selectedRealmRoles).success(function() {
                updateRealmRoles();
                Notifications.success("Scope mappings updated.");
            });
    };

    $scope.deleteRealmRole = function() {
        $http.delete(authUrl + '/admin/realms/' + realm.realm + '/clients-by-id/' + client.id +  '/scope-mappings/realm',
            {data : $scope.selectedRealmMappings, headers : {"content-type" : "application/json"}}).success(function () {
                updateRealmRoles();
                Notifications.success("Scope mappings updated.");
            });
    };

    $scope.addClientRole = function() {
        $http.post(authUrl + '/admin/realms/' + realm.realm + '/clients-by-id/' + client.id +  '/scope-mappings/clients-by-id/' + $scope.targetClient.id,
                $scope.selectedClientRoles).success(function () {
                updateClientRoles();
                Notifications.success("Scope mappings updated.");
            });
    };

    $scope.deleteClientRole = function() {
        $http.delete(authUrl + '/admin/realms/' + realm.realm + '/clients-by-id/' + client.id +  '/scope-mappings/clients-by-id/' + $scope.targetClient.id,
            {data : $scope.selectedClientMappings, headers : {"content-type" : "application/json"}}).success(function () {
                updateClientRoles();
                Notifications.success("Scope mappings updated.");
            });
    };

    updateRealmRoles();
});

module.controller('ClientRevocationCtrl', function($scope, realm, client, Client, ClientPushRevocation, $location, Dialog, Notifications) {
    $scope.realm = realm;
    $scope.client = client;

    var setNotBefore = function() {
        if ($scope.client.notBefore == 0) {
            $scope.notBefore = "None";
        } else {
            $scope.notBefore = new Date($scope.client.notBefore * 1000);
        }
    };

    setNotBefore();

    var refresh = function() {
        Client.get({ realm : realm.realm, client: $scope.client.id }, function(updated) {
            $scope.client = updated;
            setNotBefore();
        })

    };

    $scope.clear = function() {
        $scope.client.notBefore = 0;
        Client.update({ realm : realm.realm, client: client.id}, $scope.client, function () {
            $scope.notBefore = "None";
            Notifications.success('Not Before cleared for client.');
            refresh();
        });
    }
    $scope.setNotBeforeNow = function() {
        $scope.client.notBefore = new Date().getTime()/1000;
        Client.update({ realm : realm.realm, client: $scope.client.id}, $scope.client, function () {
            Notifications.success('Not Before set for client.');
            refresh();
        });
    }
    $scope.pushRevocation = function() {
        ClientPushRevocation.save({realm : realm.realm, client: $scope.client.id}, function (globalReqResult) {
            var successCount = globalReqResult.successRequests ? globalReqResult.successRequests.length : 0;
            var failedCount  = globalReqResult.failedRequests ? globalReqResult.failedRequests.length : 0;

            if (successCount==0 && failedCount==0) {
                Notifications.warn('No push sent. No admin URI configured or no registered cluster nodes available');
            } else if (failedCount > 0) {
                var msgStart = successCount>0 ? 'Successfully push notBefore to: ' + globalReqResult.successRequests + ' . ' : '';
                Notifications.error(msgStart + 'Failed to push notBefore to: ' + globalReqResult.failedRequests + '. Verify availability of failed hosts and try again');
            } else {
                Notifications.success('Successfully push notBefore to: ' + globalReqResult.successRequests);
            }
        });
    }

});

module.controller('ClientClusteringCtrl', function($scope, client, Client, ClientTestNodesAvailable, realm, $location, $route, Notifications, TimeUnit) {
    $scope.client = client;
    $scope.realm = realm;

    var oldCopy = angular.copy($scope.client);
    $scope.changed = false;

    $scope.$watch('client', function() {
        if (!angular.equals($scope.client, oldCopy)) {
            $scope.changed = true;
        }
    }, true);

    $scope.client.nodeReRegistrationTimeoutUnit = TimeUnit.autoUnit(client.nodeReRegistrationTimeout);
    $scope.client.nodeReRegistrationTimeout = TimeUnit.toUnit(client.nodeReRegistrationTimeout, $scope.client.nodeReRegistrationTimeoutUnit);
    $scope.$watch('client.nodeReRegistrationTimeoutUnit', function(to, from) {
        $scope.client.nodeReRegistrationTimeout = TimeUnit.convert($scope.client.nodeReRegistrationTimeout, from, to);
    });

    $scope.save = function() {
        var clientCopy = angular.copy($scope.client);
        delete clientCopy['nodeReRegistrationTimeoutUnit'];
        clientCopy.nodeReRegistrationTimeout = TimeUnit.toSeconds($scope.client.nodeReRegistrationTimeout, $scope.client.nodeReRegistrationTimeoutUnit)
        Client.update({ realm : realm.realm, client : client.id }, clientCopy, function () {
            $route.reload();
            Notifications.success('Your changes have been saved to the client.');
        });
    };

    $scope.reset = function() {
        $route.reload();
    };

    $scope.testNodesAvailable = function() {
        ClientTestNodesAvailable.get({ realm : realm.realm, client : client.id }, function(globalReqResult) {
            $route.reload();

            var successCount = globalReqResult.successRequests ? globalReqResult.successRequests.length : 0;
            var failedCount  = globalReqResult.failedRequests ? globalReqResult.failedRequests.length : 0;

            if (successCount==0 && failedCount==0) {
                Notifications.warn('No requests sent. No admin URI configured or no registered cluster nodes available');
            } else if (failedCount > 0) {
                var msgStart = successCount>0 ? 'Successfully verify availability for ' + globalReqResult.successRequests + ' . ' : '';
                Notifications.error(msgStart + 'Failed to verify availability for: ' + globalReqResult.failedRequests + '. Fix or unregister failed cluster nodes and try again');
            } else {
                Notifications.success('Successfully sent requests to: ' + globalReqResult.successRequests);
            }
        });
    };

    if (client.registeredNodes) {
        var nodeRegistrations = [];
        for (node in client.registeredNodes) {
            reg = {
                host: node,
                lastRegistration: new Date(client.registeredNodes[node] * 1000)
            }
            nodeRegistrations.push(reg);
        }

        $scope.nodeRegistrations = nodeRegistrations;
    };
});

module.controller('ClientClusteringNodeCtrl', function($scope, client, Client, ClientClusterNode, realm, $location, $routeParams, Notifications) {
    $scope.client = client;
    $scope.realm = realm;
    $scope.create = !$routeParams.node;

    $scope.save = function() {
        ClientClusterNode.save({ realm : realm.realm, client : client.id , node: $scope.node.host }, function() {
            Notifications.success('Node ' + $scope.node.host + ' registered successfully.');
            $location.url('/realms/' + realm.realm + '/clients/' + client.id +  '/clustering');
        });
    }

    $scope.unregisterNode = function() {
        ClientClusterNode.remove({ realm : realm.realm, client : client.id , node: $scope.node.host }, function() {
            Notifications.success('Node ' + $scope.node.host + ' unregistered successfully.');
            $location.url('/realms/' + realm.realm + '/clients/' + client.id +  '/clustering');
        });
    }

    if ($scope.create) {
        $scope.node = {}
        $scope.registered = false;
    } else {
        var lastRegTime = client.registeredNodes[$routeParams.node];

        if (lastRegTime) {
            $scope.registered = true;
            $scope.node = {
                host: $routeParams.node,
                lastRegistration: new Date(lastRegTime * 1000)
            }

        } else {
            $scope.registered = false;
            $scope.node = {
                host: $routeParams.node
            }
        }
    }
});

module.controller('AddBuiltinProtocolMapperCtrl', function($scope, realm, client, serverInfo,
                                                            ClientProtocolMappersByProtocol,
                                                            $http, $location, Dialog, Notifications) {
    $scope.realm = realm;
    $scope.client = client;
    if (client.protocol == null) {
        client.protocol = 'openid-connect';
    }

    var protocolMappers = serverInfo.protocolMapperTypes[client.protocol];
    var mapperTypes = {};
    for (var i = 0; i < protocolMappers.length; i++) {
        mapperTypes[protocolMappers[i].id] = protocolMappers[i];
    }
    $scope.mapperTypes = mapperTypes;




    var updateMappers = function() {
        var clientMappers = ClientProtocolMappersByProtocol.query({realm : realm.realm, client : client.id, protocol : client.protocol}, function() {
            var builtinMappers = serverInfo.builtinProtocolMappers[client.protocol];
            for (var i = 0; i < clientMappers.length; i++) {
                for (var j = 0; j < builtinMappers.length; j++) {
                    if (builtinMappers[j].name == clientMappers[i].name
                        && builtinMappers[j].protocolMapper == clientMappers[i].protocolMapper) {
                        builtinMappers.splice(j, 1);
                        break;
                    }
                }
            }
            $scope.mappers = builtinMappers;
            for (var i = 0; i < $scope.mappers.length; i++) {
                $scope.mappers[i].isChecked = false;
            }


        });
    };

    updateMappers();

    $scope.add = function() {
        var toAdd = [];
        for (var i = 0; i < $scope.mappers.length; i++) {
            if ($scope.mappers[i].isChecked) {
                delete $scope.mappers[i].isChecked;
                toAdd.push($scope.mappers[i]);
            }
        }
        $http.post(authUrl + '/admin/realms/' + realm.realm + '/clients-by-id/' + client.id + '/protocol-mappers/add-models',
                   toAdd).success(function() {
                Notifications.success("Mappers added");
                $location.url('/realms/' + realm.realm + '/clients/' + client.id +  '/mappers');
            }).error(function() {
                Notifications.error("Error adding mappers");
                $location.url('/realms/' + realm.realm + '/clients/' + client.id +  '/mappers');
            });
    };

});

module.controller('ClientProtocolMapperListCtrl', function($scope, realm, client, serverInfo,
                                                           ClientProtocolMappersByProtocol,
                                                           $http, $location, Dialog, Notifications) {
    $scope.realm = realm;
    $scope.client = client;
    if (client.protocol == null) {
        client.protocol = 'openid-connect';
    }

    var protocolMappers = serverInfo.protocolMapperTypes[client.protocol];
    var mapperTypes = {};
    for (var i = 0; i < protocolMappers.length; i++) {
        mapperTypes[protocolMappers[i].id] = protocolMappers[i];
    }
    $scope.mapperTypes = mapperTypes;


    var updateMappers = function() {
        $scope.mappers = ClientProtocolMappersByProtocol.query({realm : realm.realm, client : client.id, protocol : client.protocol});
    };

    updateMappers();
});

module.controller('ClientProtocolMapperCtrl', function($scope, realm, serverInfo, client, mapper, ClientProtocolMapper, Notifications, Dialog, $location) {
    $scope.realm = realm;
    $scope.client = client;
    $scope.create = false;
    if (client.protocol == null) {
        client.protocol = 'openid-connect';
    }
    $scope.protocol = client.protocol;
    $scope.mapper = angular.copy(mapper);
    $scope.changed = false;
    $scope.boolval = true;
    $scope.boolvalId = 'boolval';

    var protocolMappers = serverInfo.protocolMapperTypes[client.protocol];
    for (var i = 0; i < protocolMappers.length; i++) {
        if (protocolMappers[i].id == mapper.protocolMapper) {
            $scope.mapperType = protocolMappers[i];
        }
    }
    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });

    $scope.$watch('mapper', function() {
        if (!angular.equals($scope.mapper, mapper)) {
            $scope.changed = true;
        }
    }, true);

    $scope.save = function() {
        ClientProtocolMapper.update({
            realm : realm.realm,
            client: client.id,
            id : mapper.id
        }, $scope.mapper, function() {
            $scope.changed = false;
            mapper = angular.copy($scope.mapper);
            $location.url("/realms/" + realm.realm + '/clients/' + client.id + "/mappers/" + mapper.id);
            Notifications.success("Your changes have been saved.");
        });
    };

    $scope.reset = function() {
        $scope.mapper = angular.copy(mapper);
        $scope.changed = false;
    };

    $scope.cancel = function() {
        //$location.url("/realms");
        window.history.back();
    };

    $scope.remove = function() {
        Dialog.confirmDelete($scope.mapper.name, 'mapper', function() {
            ClientProtocolMapper.remove({ realm: realm.realm, client: client.id, id : $scope.mapper.id }, function() {
                Notifications.success("The mapper has been deleted.");
                $location.url("/realms/" + realm.realm + '/clients/' + client.id + "/mappers");
            });
        });
    };

});

module.controller('ClientProtocolMapperCreateCtrl', function($scope, realm, serverInfo, client, ClientProtocolMapper, Notifications, Dialog, $location) {
    $scope.realm = realm;
    $scope.client = client;
    $scope.create = true;
    if (client.protocol == null) {
        client.protocol = 'openid-connect';
    }
    var protocol = client.protocol;
    $scope.protocol = protocol;
    $scope.mapper = { protocol :  client.protocol, config: {}};
    $scope.mapperTypes = serverInfo.protocolMapperTypes[protocol];

    $scope.$watch(function() {
        return $location.path();
    }, function() {
        $scope.path = $location.path().substring(1).split("/");
    });

    $scope.save = function() {
        $scope.mapper.protocolMapper = $scope.mapperType.id;
        ClientProtocolMapper.save({
            realm : realm.realm, client: client.id
        }, $scope.mapper, function(data, headers) {
            var l = headers().location;
            var id = l.substring(l.lastIndexOf("/") + 1);
            $location.url("/realms/" + realm.realm + '/clients/' + client.id + "/mappers/" + id);
            Notifications.success("Mapper has been created.");
        });
    };

    $scope.cancel = function() {
        //$location.url("/realms");
        window.history.back();
    };


});




